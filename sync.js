// Authentication, pairing, persistence, and Supabase synchronization.

async function initializeSupabaseSync() {
  setAuthMessage("Connecting to Supabase...");
  setAuthLoading(true);

  try {
    const { createClient } = await importSupabaseClient();
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    });

    supabaseClient.auth.onAuthStateChange((_event, session) => {
      if (!session?.user && supabaseUserId) {
        showAuthView();
      }
    });

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
      throw error;
    }

    if (!data.session?.user) {
      showAuthView("Sign in to load your planner.");
      return;
    }

    await loadAuthenticatedPlanner(data.session.user);
  } catch (error) {
    showAuthView(`Supabase error: ${formatSupabaseError(error)}`, true);
  } finally {
    setAuthLoading(false);
  }
}

async function importSupabaseClient() {
  try {
    return await import(SUPABASE_CLIENT_MODULE_URL);
  } catch (primaryError) {
    try {
      return await import(SUPABASE_CLIENT_FALLBACK_MODULE_URL);
    } catch (fallbackError) {
      throw new Error(
        `Could not load Supabase client. Primary: ${formatSupabaseError(primaryError)}. Fallback: ${formatSupabaseError(fallbackError)}`
      );
    }
  }
}

async function loadAuthenticatedPlanner(user) {
  setSupabaseSyncStatus("connecting");
  supabaseUserId = user.id;
  signedInUserEmail = user.email || "Signed in";
  activeStorageKey = getUserStorageKey(user.id);
  partnerState = null;
  sharedRjState = createDefaultSharedRjState();
  sharedRjPairingId = "";
  sharedRjSyncPending = false;
  sharedRjRemoteAvailable = true;
  sharedRjRemoteNotice = "";
  pairingContext = createEmptyPairingContext();

  await upsertPlannerProfile(user);

  const hasUserLocalState = hasStoredState(activeStorageKey);
  const userLocalState = hasUserLocalState ? loadStateFromStorage(activeStorageKey) : null;
  const remoteState = await loadSupabaseState();
  const shouldMigrateLegacyState = shouldImportLegacyState(user.id, hasUserLocalState, remoteState);
  const localState = shouldMigrateLegacyState ? loadStateFromStorage(STORAGE_KEY) : userLocalState;
  const hasLocalState = Boolean(localState);
  const shouldUseRemoteState = remoteState && (!hasLocalState || isStateNewer(remoteState, localState));
  let shouldUploadState = !remoteState || (!shouldUseRemoteState && hasLocalState && isStateNewer(localState, remoteState));

  state = shouldUseRemoteState ? remoteState : localState || structuredClone(defaultState);
  showInitialListSet();
  if (!state.lastSavedAt) {
    state.lastSavedAt = new Date().toISOString();
    shouldUploadState = true;
  }
  selfState = state;

  const didAuthBackfill = backfillCompletionOrders(state);
  const didAuthTimedUpdate = runTimedUpdatesIfNeeded();

  if (didAuthBackfill || didAuthTimedUpdate) {
    shouldUploadState = true;
  }

  persistLocalState();
  await refreshPairingContext({ silent: true });
  hydrateStateUIAfterRemoteLoad();
  showPlannerView();

  supabaseSyncReady = true;
  setSupabaseSyncStatus("synced");

  if (getAcceptedPairing() && sharedRjState.lastSavedAt) {
    queueSharedRjSync();
  }

  if (shouldMigrateLegacyState) {
    pendingLegacyMigrationUserId = user.id;
  }

  if (shouldUploadState || shouldMigrateLegacyState) {
    queueSupabaseSync();
  }
}

function shouldImportLegacyState(userId, hasUserLocalState, remoteState) {
  if (hasUserLocalState || remoteState || !hasStoredState(STORAGE_KEY)) {
    return false;
  }

  try {
    return localStorage.getItem(AUTH_MIGRATION_KEY) !== userId;
  } catch {
    return true;
  }
}

function createEmptyPairingContext() {
  return {
    accepted: null,
    incoming: null,
    outgoing: null,
    profiles: {},
  };
}

async function upsertPlannerProfile(user) {
  const email = String(user.email || "").trim().toLowerCase();

  if (!email) {
    throw new Error("Supabase did not return an email for this user.");
  }

  const { error } = await supabaseClient.from(SUPABASE_PROFILE_TABLE).upsert({
    owner_id: user.id,
    email,
    updated_at: new Date().toISOString(),
  });

  if (error) {
    throw error;
  }

  signedInUserEmail = email;
}

async function refreshPairingContext({ silent = false } = {}) {
  if (!supabaseClient || !supabaseUserId || pairingRefreshInFlight) {
    return;
  }

  pairingRefreshInFlight = true;

  try {
    const { data: pairings, error } = await supabaseClient
      .from(SUPABASE_PAIRING_TABLE)
      .select("id, requester_id, recipient_id, status, created_at, responded_at")
      .or(`requester_id.eq.${supabaseUserId},recipient_id.eq.${supabaseUserId}`)
      .in("status", ["pending", "accepted"])
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    const context = createEmptyPairingContext();
    const activePairings = Array.isArray(pairings) ? pairings : [];

    context.accepted = activePairings.find((pairing) => pairing.status === "accepted") || null;
    context.incoming =
      activePairings.find((pairing) => pairing.status === "pending" && pairing.recipient_id === supabaseUserId) || null;
    context.outgoing =
      activePairings.find((pairing) => pairing.status === "pending" && pairing.requester_id === supabaseUserId) || null;

    const profileIds = [
      supabaseUserId,
      ...activePairings.map((pairing) => getOtherPairingUserId(pairing)).filter(Boolean),
    ];
    context.profiles = await loadPlannerProfiles([...new Set(profileIds)]);
    pairingContext = context;

    if (context.accepted) {
      await Promise.all([loadPartnerPlannerState({ silent: true }), loadSharedRjPlannerState({ silent: true })]);
    } else {
      partnerState = null;
      sharedRjState = createDefaultSharedRjState();
      sharedRjPairingId = "";
      sharedRjSyncPending = false;
      sharedRjRemoteAvailable = true;
      sharedRjRemoteNotice = "";
    }

    renderPairingControls();
    renderSaveStatus();
  } catch (error) {
    if (!silent) {
      setPairingMessage(formatSupabaseError(error), true);
    }
  } finally {
    pairingRefreshInFlight = false;
  }
}

async function loadPlannerProfiles(ownerIds) {
  if (!ownerIds.length) {
    return {};
  }

  const { data, error } = await supabaseClient
    .from(SUPABASE_PROFILE_TABLE)
    .select("owner_id, email")
    .in("owner_id", ownerIds);

  if (error) {
    throw error;
  }

  return Object.fromEntries((data || []).map((profile) => [profile.owner_id, profile]));
}

async function loadPartnerPlannerState({ silent = false } = {}) {
  const acceptedPairing = getAcceptedPairing();
  const partnerUserId = acceptedPairing ? getOtherPairingUserId(acceptedPairing) : "";

  if (!partnerUserId) {
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_STATE_TABLE)
      .select("data")
      .eq("owner_id", partnerUserId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const visibleListSetId = getVisibleListSetId();
    partnerState = data?.data ? normalizeStateData(data.data) : createPartnerFallbackState();
    setPlannerStateListSet(partnerState, visibleListSetId);

    if (state.activeListSet === "rj") {
      renderPartnerRjList();
    } else {
      renderPartnerMsLists();
    }

  } catch (error) {
    if (!silent) {
      setPairingMessage(formatSupabaseError(error), true);
    }
  }
}

function createPartnerFallbackState() {
  return {
    ...structuredClone(defaultState),
    activeListSet: getVisibleListSetId(),
  };
}

function getSharedRjStorageKey(pairingId) {
  return `${STORAGE_KEY}:shared:${pairingId}`;
}

function loadSharedRjStateFromStorage(pairingId) {
  try {
    const raw = localStorage.getItem(getSharedRjStorageKey(pairingId));
    return raw ? normalizeSharedRjState(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

async function loadSharedRjPlannerState({ silent = false } = {}) {
  const acceptedPairing = getAcceptedPairing();
  const pairingId = acceptedPairing?.id || "";

  if (!pairingId || (sharedRjSyncPending && sharedRjPairingId === pairingId)) {
    return;
  }

  const localState = loadSharedRjStateFromStorage(pairingId);

  if (!sharedRjRemoteAvailable) {
    sharedRjState = localState || createDefaultSharedRjState();
    sharedRjPairingId = pairingId;
    resetSharedRjDayIfNeeded();
    return;
  }

  try {
    const { data, error } = await supabaseClient
      .from(SUPABASE_SHARED_STATE_TABLE)
      .select("data, updated_at")
      .eq("pairing_id", pairingId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    const remoteState = data?.data ? normalizeSharedRjState(data.data) : null;
    const shouldUseRemote = remoteState && (!localState || isStateNewer(remoteState, localState));
    sharedRjState = shouldUseRemote ? remoteState : localState || remoteState || createDefaultSharedRjState();
    sharedRjPairingId = pairingId;
    resetSharedRjDayIfNeeded();
    persistSharedRjState();

    if (state.activeListSet === "rj") {
      renderSharedRjLists();
    }
  } catch (error) {
    sharedRjState = localState || createDefaultSharedRjState();
    sharedRjPairingId = pairingId;
    const isMissingTable = isMissingSharedStateTableError(error);

    if (isMissingTable) {
      sharedRjRemoteAvailable = false;
      sharedRjRemoteNotice = "Shared lists are saved locally until Supabase setup is updated.";
      sharedRjSyncPending = false;
      renderSaveStatus();
    }

    if (!silent && !isMissingTable) {
      setPairingMessage(formatSupabaseError(error), true);
    }
    resetSharedRjDayIfNeeded();
  }
}

function getOtherPairingUserId(pairing) {
  if (!pairing) {
    return "";
  }

  return pairing.requester_id === supabaseUserId ? pairing.recipient_id : pairing.requester_id;
}

function getPairingOtherEmail(pairing) {
  const otherUserId = getOtherPairingUserId(pairing);
  return pairingContext.profiles[otherUserId]?.email || "partner";
}

function getPairingDisplayName(pairing) {
  const preferredName = normalizePairedDisplayName(selfState?.settings?.pairedAccountDisplayName);

  if (preferredName) {
    return preferredName;
  }

  const email = getPairingOtherEmail(pairing);
  const fallbackName = email.includes("@") ? email.split("@")[0] : email || "Partner";
  return normalizePairedDisplayName(fallbackName) || "Partner";
}

function togglePairedNameEditor() {
  if (els.pairedNameEditor.hidden) {
    showPairedNameEditor();
    return;
  }

  hidePairedNameEditor();
}

function showPairedNameEditor() {
  const acceptedPairing = getAcceptedPairing();

  if (!acceptedPairing) {
    return;
  }

  els.pairedDisplayName.value = getPairingDisplayName(acceptedPairing);
  els.pairedNameEditor.hidden = false;
  els.pairedNameToggleBtn.textContent = "Done";
  els.pairedNameToggleBtn.setAttribute("aria-expanded", "true");
  els.pairedDisplayName.focus();
  els.pairedDisplayName.select();
}

function hidePairedNameEditor() {
  els.pairedNameEditor.hidden = true;
  els.pairedNameToggleBtn.textContent = "Change name";
  els.pairedNameToggleBtn.setAttribute("aria-expanded", "false");
}

function handlePairedDisplayNameInput() {
  const nextName = normalizePairedDisplayName(els.pairedDisplayName.value);

  if (selfState.settings.pairedAccountDisplayName === nextName) {
    return;
  }

  selfState.settings.pairedAccountDisplayName = nextName;
  saveSelfState();
  renderPairingControls();
}

async function handlePairingInviteSubmit(event) {
  event.preventDefault();

  if (!supabaseClient || !supabaseUserId) {
    setPairingMessage("Sign in before pairing.", true);
    return;
  }

  const email = els.pairingEmail.value.trim().toLowerCase();

  if (!email) {
    setPairingMessage("Enter a registered email address.", true);
    return;
  }

  setPairingLoading(true);
  setPairingMessage("Sending invitation...");

  try {
    const { error } = await supabaseClient.rpc("invite_planner_pair", {
      target_email: email,
    });

    if (error) {
      throw error;
    }

    els.pairingEmail.value = "";
    setPairingMessage("Invitation sent.");
    await refreshPairingContext({ silent: true });
  } catch (error) {
    setPairingMessage(formatSupabaseError(error), true);
  } finally {
    setPairingLoading(false);
  }
}

async function respondToIncomingPairing(shouldAccept) {
  const incoming = pairingContext.incoming;

  if (!incoming) {
    return;
  }

  setPairingLoading(true);
  setPairingMessage(shouldAccept ? "Accepting invitation..." : "Declining invitation...");

  try {
    const { error } = await supabaseClient.rpc("respond_planner_pair", {
      pairing_id: incoming.id,
      accept_invite: shouldAccept,
    });

    if (error) {
      throw error;
    }

    setPairingMessage(shouldAccept ? "Pairing accepted." : "Invitation declined.");
    await refreshPairingContext({ silent: true });
  } catch (error) {
    setPairingMessage(formatSupabaseError(error), true);
  } finally {
    setPairingLoading(false);
  }
}

async function cancelOutgoingPairing() {
  const outgoing = pairingContext.outgoing;

  if (!outgoing) {
    return;
  }

  await deletePairing(outgoing.id, "Invitation canceled.");
}

async function removeAcceptedPairing() {
  const acceptedPairing = pairingContext.accepted;

  if (!acceptedPairing) {
    return;
  }

  await deletePairing(acceptedPairing.id, "Pairing removed.");
}

async function deletePairing(pairingId, successMessage) {
  setPairingLoading(true);
  setPairingMessage("Updating pairing...");

  try {
    const { error } = await supabaseClient.rpc("delete_planner_pair", {
      pairing_id: pairingId,
    });

    if (error) {
      throw error;
    }

    setPairingMessage(successMessage);
    await refreshPairingContext({ silent: true });
  } catch (error) {
    setPairingMessage(formatSupabaseError(error), true);
  } finally {
    setPairingLoading(false);
  }
}

function setPairingLoading(isLoading) {
  els.pairingEmail.disabled = isLoading;
  els.pairingInviteBtn.disabled = isLoading;
  els.pairingAcceptBtn.disabled = isLoading;
  els.pairingDeclineBtn.disabled = isLoading;
  els.pairingCancelBtn.disabled = isLoading;
  els.pairingRemoveBtn.disabled = isLoading;
  els.pairedNameToggleBtn.disabled = isLoading;
  els.pairedDisplayName.disabled = isLoading;
}

function setPairingMessage(message, isError = false) {
  els.pairingMessage.textContent = message;
  els.pairingMessage.classList.toggle("error", isError);
}

function renderPairingControls() {
  const acceptedPairing = pairingContext.accepted;
  const incoming = pairingContext.incoming;
  const outgoing = pairingContext.outgoing;

  els.pairingForm.hidden = Boolean(acceptedPairing || incoming || outgoing);
  els.pairingIncoming.hidden = !incoming;
  els.pairingOutgoing.hidden = !outgoing;
  els.pairingConnected.hidden = !acceptedPairing;

  if (!acceptedPairing) {
    hidePairedNameEditor();
  }

  if (incoming) {
    els.pairingIncomingCopy.textContent = `${getPairingOtherEmail(incoming)} invited you to pair planners.`;
  }

  if (outgoing) {
    els.pairingOutgoingCopy.textContent = `Waiting for ${getPairingOtherEmail(outgoing)} to respond.`;
  }

  if (acceptedPairing) {
    els.pairingConnectedCopy.textContent = `Paired with ${getPairingDisplayName(acceptedPairing)}.`;
  }
}

async function loadSupabaseState() {
  const { data, error } = await supabaseClient
    .from(SUPABASE_STATE_TABLE)
    .select("data")
    .eq("owner_id", supabaseUserId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.data ? normalizeStateData(data.data) : null;
}

function hydrateStateUIAfterRemoteLoad() {
  hydrateSettingsUI();
  updateRecurringShowDaysVisibility();
  renderAll();
}

async function handleAuthSubmit(event) {
  event.preventDefault();

  if (!supabaseClient) {
    setAuthMessage("Supabase is still connecting. Try again in a moment.", true);
    return;
  }

  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  const confirmPassword = els.authConfirmPassword.value;

  if (!email || !password) {
    setAuthMessage("Enter your email and password.", true);
    return;
  }

  if (authMode === "sign-up" && password !== confirmPassword) {
    setAuthMessage("Passwords do not match.", true);
    return;
  }

  setAuthLoading(true);
  setAuthMessage(authMode === "sign-up" ? "Creating account..." : "Signing in...");

  try {
    const authResult =
      authMode === "sign-up"
        ? await supabaseClient.auth.signUp({ email, password })
        : await supabaseClient.auth.signInWithPassword({ email, password });

    if (authResult.error) {
      throw authResult.error;
    }

    if (authMode === "sign-up" && authResult.data.user && Array.isArray(authResult.data.user.identities)) {
      if (authResult.data.user.identities.length === 0) {
        setAuthMessage("Could not create account. Email already registered.", true);
        return;
      }
    }

    if (!authResult.data.session?.user) {
      setAuthMessage(authMode === "sign-up" ? "Confirm your email to create your account." : "Check your email, then sign in.");
      return;
    }

    await loadAuthenticatedPlanner(authResult.data.session.user);
  } catch (error) {
    setAuthMessage(formatAuthError(error), true);
  } finally {
    setAuthLoading(false);
  }
}

async function handlePasswordChangeSubmit(event) {
  event.preventDefault();

  if (els.passwordFields.hidden) {
    showPasswordFields();
    return;
  }

  if (!supabaseClient || !supabaseUserId) {
    setPasswordMessage("Sign in before changing your password.", true);
    return;
  }

  const password = els.newPassword.value;
  const confirmation = els.confirmNewPassword.value;

  if (!password || !confirmation) {
    setPasswordMessage("Enter and confirm a new password.", true);
    return;
  }

  if (password.length < 6) {
    setPasswordMessage("Password must be at least 6 characters.", true);
    return;
  }

  if (password !== confirmation) {
    setPasswordMessage("Passwords do not match.", true);
    return;
  }

  setPasswordLoading(true);
  setPasswordMessage("Updating password...");

  try {
    const { error } = await supabaseClient.auth.updateUser({ password });

    if (error) {
      throw error;
    }

    els.newPassword.value = "";
    els.confirmNewPassword.value = "";
    setPasswordMessage("Password updated.");
  } catch (error) {
    setPasswordMessage(formatSupabaseError(error), true);
  } finally {
    setPasswordLoading(false);
  }
}

function showPasswordFields() {
  els.passwordFields.hidden = false;
  els.passwordToggleBtn.hidden = true;
  els.passwordToggleBtn.setAttribute("aria-expanded", "true");
  setPasswordMessage("");
  els.newPassword.focus();
}

function resetPasswordSection() {
  els.passwordFields.hidden = true;
  els.passwordToggleBtn.hidden = false;
  els.passwordToggleBtn.setAttribute("aria-expanded", "false");
  els.newPassword.value = "";
  els.confirmNewPassword.value = "";
  setPasswordLoading(false);
  setPasswordMessage("");
}

function cancelPasswordChange() {
  resetPasswordSection();
  els.passwordToggleBtn.focus();
}

function setPasswordLoading(isLoading) {
  els.newPassword.disabled = isLoading;
  els.confirmNewPassword.disabled = isLoading;
  els.passwordSubmitBtn.disabled = isLoading;
  els.passwordCancelBtn.disabled = isLoading;
}

function setPasswordMessage(message, isError = false) {
  els.passwordMessage.textContent = message;
  els.passwordMessage.classList.toggle("error", isError);
  els.passwordMessage.hidden = !message;
}

function showDeleteAccountConfirm() {
  setDeleteAccountMessage("");
  els.deleteAccountConfirm.hidden = false;
  els.deleteAccountConfirmInput.value = "";
  updateDeleteAccountConfirmState();
  els.deleteAccountConfirmInput.focus();
}

function hideDeleteAccountConfirm({ restoreFocus = true } = {}) {
  els.deleteAccountConfirm.hidden = true;
  els.deleteAccountConfirmInput.value = "";
  updateDeleteAccountConfirmState();

  if (restoreFocus) {
    els.deleteAccountStartBtn.focus();
  }
}

function updateDeleteAccountConfirmState() {
  els.deleteAccountConfirmBtn.disabled = els.deleteAccountConfirmInput.value.trim() !== "DELETE";
}

async function handleDeleteAccountConfirm() {
  if (els.deleteAccountConfirmBtn.disabled) {
    return;
  }

  if (!supabaseClient || !supabaseUserId) {
    setDeleteAccountMessage("Sign in before deleting your account.", true);
    return;
  }

  setDeleteAccountLoading(true);
  setDeleteAccountMessage("Deleting account...");
  const deletedStorageKey = activeStorageKey;
  let didDeleteAccount = false;

  try {
    const { error } = await supabaseClient.rpc("delete_current_planner_account");

    if (error) {
      throw error;
    }

    didDeleteAccount = true;
    clearDeletedAccountLocalState(deletedStorageKey);

    try {
      await supabaseClient.auth.signOut({ scope: "local" });
    } catch {
      // The auth record is already gone; local UI cleanup below is the important part.
    }

    showAuthView("Account deleted.");
  } catch (error) {
    setDeleteAccountMessage(formatSupabaseError(error), true);
  } finally {
    if (!didDeleteAccount) {
      setDeleteAccountLoading(false);
    }
  }
}

function setDeleteAccountLoading(isLoading) {
  els.deleteAccountStartBtn.disabled = isLoading;
  els.deleteAccountConfirmInput.disabled = isLoading;
  els.deleteAccountCancelBtn.disabled = isLoading;
  els.deleteAccountConfirmBtn.disabled = isLoading || els.deleteAccountConfirmInput.value.trim() !== "DELETE";
}

function setDeleteAccountMessage(message, isError = false) {
  els.deleteAccountMessage.textContent = message;
  els.deleteAccountMessage.classList.toggle("error", isError);
}

function clearDeletedAccountLocalState(storageKey) {
  try {
    localStorage.removeItem(storageKey);
    localStorage.removeItem(AUTH_MIGRATION_KEY);
  } catch {
    // Local storage cleanup is best effort; Supabase remains the source of truth.
  }
}

async function handleSignOut() {
  if (!supabaseClient) {
    showAuthView();
    return;
  }

  setSupabaseSyncStatus("syncing");

  try {
    const { error } = await supabaseClient.auth.signOut();

    if (error) {
      throw error;
    }

    showAuthView();
  } catch (error) {
    setSupabaseSyncStatus("error", error);
  }
}

function setAuthMode(nextMode) {
  authMode = nextMode === "sign-up" ? "sign-up" : "sign-in";
  const isSignUp = authMode === "sign-up";

  els.authSignInMode.classList.toggle("active", !isSignUp);
  els.authSignUpMode.classList.toggle("active", isSignUp);
  els.authPassword.autocomplete = isSignUp ? "new-password" : "current-password";
  els.authConfirmPasswordLabel.hidden = !isSignUp;
  els.authConfirmPassword.hidden = !isSignUp;
  els.authConfirmPassword.required = isSignUp;
  if (!isSignUp) {
    els.authConfirmPassword.value = "";
  }
  els.authSubmitBtn.textContent = isSignUp ? "Create account" : "Sign in";
  setAuthMessage("");
}

function setAuthLoading(isLoading) {
  els.authEmail.disabled = isLoading;
  els.authPassword.disabled = isLoading;
  els.authConfirmPassword.disabled = isLoading;
  els.authSubmitBtn.disabled = isLoading;
  els.authSignInMode.disabled = isLoading;
  els.authSignUpMode.disabled = isLoading;
}

function setAuthMessage(message, isError = false) {
  els.authMessage.textContent = message;
  els.authMessage.classList.toggle("error", isError);
}

function showAuthView(message = "", isError = false) {
  supabaseSyncReady = false;
  supabaseSyncPending = false;
  supabaseSyncInFlight = false;
  supabaseUserId = "";
  signedInUserEmail = "";
  activeStorageKey = STORAGE_KEY;
  state = structuredClone(defaultState);
  selfState = state;
  partnerState = null;
  sharedRjState = createDefaultSharedRjState();
  sharedRjPairingId = "";
  sharedRjSyncPending = false;
  sharedRjRemoteAvailable = true;
  sharedRjRemoteNotice = "";
  pairingContext = createEmptyPairingContext();
  closeSettingsModal();
  renderAll();

  els.appHeader.hidden = true;
  els.listsView.hidden = true;
  els.authView.hidden = false;
  els.authUserLabel.textContent = "";
  setSupabaseSyncStatus("local");
  setAuthMessage(message, isError);
}

function showPlannerView() {
  els.authView.hidden = true;
  els.appHeader.hidden = false;
  els.listsView.hidden = false;
  els.authUserLabel.textContent = signedInUserEmail;
  setAuthMessage("");
  renderPairingControls();
}

function isStateNewer(candidateState, currentState) {
  return savedAtToTime(candidateState?.lastSavedAt) > savedAtToTime(currentState?.lastSavedAt);
}

function savedAtToTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function saveState() {
  if (isReadOnlyView()) {
    renderSaveStatus();
    return;
  }

  state.lastSavedAt = new Date().toISOString();
  selfState = state;
  persistLocalState();
  renderSaveStatus();
  queueSupabaseSync();
}

function saveSelfState() {
  selfState.lastSavedAt = new Date().toISOString();

  if (!isReadOnlyView()) {
    state = selfState;
  }

  persistLocalState(activeStorageKey, selfState);
  renderSaveStatus();
  queueSupabaseSync();
}

function saveSharedRjState() {
  const acceptedPairing = getAcceptedPairing();

  if (!acceptedPairing) {
    return;
  }

  sharedRjPairingId = acceptedPairing.id;
  sharedRjState.lastSavedAt = new Date().toISOString();
  persistSharedRjState();
  renderSaveStatus();
  queueSharedRjSync();
}

function persistSharedRjState() {
  if (!sharedRjPairingId) {
    return;
  }

  localStorage.setItem(getSharedRjStorageKey(sharedRjPairingId), JSON.stringify(sharedRjState));
}

function ensureSaveStatusTimestamp() {
  if (!state.lastSavedAt) {
    state.lastSavedAt = new Date().toISOString();
    persistLocalState();
  }

  renderSaveStatus();
}

function persistLocalState(storageKey = activeStorageKey, stateToPersist = state) {
  localStorage.setItem(storageKey, JSON.stringify(stateToPersist));
}

function normalizeSavedAt(value) {
  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

function queueSupabaseSync() {
  if (!supabaseSyncReady || !supabaseClient || !supabaseUserId) {
    return;
  }

  supabaseSyncPending = true;
  void flushSupabaseSync();
}

function queueSharedRjSync() {
  if (
    !supabaseSyncReady ||
    !supabaseClient ||
    !supabaseUserId ||
    !sharedRjPairingId ||
    !sharedRjRemoteAvailable
  ) {
    return;
  }

  sharedRjSyncPending = true;
  void flushSharedRjSync();
}

async function flushSharedRjSync() {
  if (sharedRjSyncInFlight) {
    return;
  }

  sharedRjSyncInFlight = true;

  try {
    while (sharedRjSyncPending) {
      sharedRjSyncPending = false;
      setSupabaseSyncStatus("syncing");
      const pairingId = sharedRjPairingId;
      const payload = JSON.parse(JSON.stringify(sharedRjState));
      const { error } = await supabaseClient.from(SUPABASE_SHARED_STATE_TABLE).upsert({
        pairing_id: pairingId,
        data: payload,
        updated_at: sharedRjState.lastSavedAt || new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      setSupabaseSyncStatus("synced");
    }
  } catch (error) {
    if (isMissingSharedStateTableError(error)) {
      sharedRjRemoteAvailable = false;
      sharedRjRemoteNotice = "Shared lists are saved locally until Supabase setup is updated.";
      sharedRjSyncPending = false;
      setSupabaseSyncStatus("synced");
      return;
    }

    sharedRjSyncPending = true;
    setSupabaseSyncStatus("error", error);
  } finally {
    sharedRjSyncInFlight = false;
  }
}

async function flushSupabaseSync() {
  if (supabaseSyncInFlight) {
    return;
  }

  supabaseSyncInFlight = true;

  try {
    while (supabaseSyncPending) {
      supabaseSyncPending = false;
      setSupabaseSyncStatus("syncing");

      const payload = JSON.parse(JSON.stringify(selfState));
      const { error } = await supabaseClient.from(SUPABASE_STATE_TABLE).upsert({
        owner_id: supabaseUserId,
        data: payload,
        updated_at: selfState.lastSavedAt || new Date().toISOString(),
      });

      if (error) {
        throw error;
      }

      if (pendingLegacyMigrationUserId === supabaseUserId) {
        localStorage.setItem(AUTH_MIGRATION_KEY, supabaseUserId);
        pendingLegacyMigrationUserId = "";
      }

      setSupabaseSyncStatus("synced");
    }
  } catch (error) {
    setSupabaseSyncStatus("error", error);
  } finally {
    supabaseSyncInFlight = false;

    if (supabaseSyncPending) {
      void flushSupabaseSync();
    }
  }
}

function setSupabaseSyncStatus(status, error = null) {
  supabaseSyncStatus = status;
  supabaseSyncErrorMessage = error ? formatSupabaseError(error) : "";

  if (error) {
    console.warn("Supabase sync failed", error);
  }

  renderSaveStatus();
}

function formatSupabaseError(error) {
  if (!error) {
    return "Unknown error";
  }

  const message =
    error.message ||
    error.error_description ||
    error.error ||
    error.details ||
    error.hint ||
    String(error);

  return String(message).replace(/\s+/g, " ").trim();
}

function isMissingSharedStateTableError(error) {
  const message = formatSupabaseError(error);

  return (
    error?.code === "PGRST205" ||
    (/planner_shared_states/i.test(message) && /schema cache|could not find the table|does not exist/i.test(message))
  );
}

function formatAuthError(error) {
  const message = formatSupabaseError(error);

  if (authMode === "sign-up" && /already|registered|exists/i.test(message)) {
    return "Could not create account. Email already registered.";
  }

  return message;
}

function renderSaveStatus() {
  const statusState = isReadOnlyView() ? selfState : state;
  const savedAt = new Date(statusState.lastSavedAt || Date.now());
  const savedTime = savedAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  els.saveStatus.title = "";

  if (supabaseSyncStatus === "connecting") {
    els.saveStatus.textContent = "Connecting Supabase...";
    return;
  }

  if (supabaseSyncStatus === "syncing") {
    els.saveStatus.textContent = "Syncing to Supabase...";
    return;
  }

  if (sharedRjRemoteNotice && getAcceptedPairing()) {
    els.saveStatus.textContent = "Shared lists saved locally";
    els.saveStatus.title = `${sharedRjRemoteNotice} Run supabase-setup.sql to enable paired sync.`;
    return;
  }

  if (supabaseSyncStatus === "synced") {
    els.saveStatus.textContent = `Auto-saved at ${savedTime}`;
    return;
  }

  if (supabaseSyncStatus === "error") {
    els.saveStatus.textContent = `Supabase error: ${supabaseSyncErrorMessage || "check console"}`;
    els.saveStatus.title = `Saved locally at ${savedTime}. ${supabaseSyncErrorMessage || ""}`;
    return;
  }

  els.saveStatus.textContent = `Auto-saved at ${savedTime}`;
}
