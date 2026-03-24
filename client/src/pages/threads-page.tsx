import { useEffect, useRef, useState } from "react";
import { MessageSquareText, Users } from "lucide-react";

import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ThreadComposer } from "./threads-page.composer";
import { ThreadsForwardModal } from "./threads-page.forward-modal";
import { ThreadMediaPreviews } from "./threads-page.media-previews";
import { ThreadMessageList } from "./threads-page.message-list";
import { ThreadsReplyDrawer } from "./threads-page.reply-drawer";
import { ThreadsSidebar } from "./threads-page.sidebar";
import { useThreadsController } from "./threads-page.controller";
import { formatTimestamp } from "./threads-page.utils";

export function ThreadsPage(): JSX.Element {
  const {
    user,
    setSearchParams,
    activeTab,
    totalMentions,
    dmMentionTotal,
    channelMentionTotal,
    searchTerm,
    setSearchTerm,
    loading,
    filteredDmUsers,
    filteredChannels,
    dmUsers,
    channelDraft,
    setChannelDraft,
    creatingChannel,
    handleCreateChannel,
    handleSelectChannel,
    channelNameDraft,
    setChannelNameDraft,
    channelDescriptionDraft,
    setChannelDescriptionDraft,
    channelSaveState,
    canManageChannel,
    canEditChannel,
    canAddChannelMembers,
    canRemoveChannelMembers,
    canManageChannelOverrides,
    canDeleteChannel,
    handleLeaveChannel,
    handleDeleteChannel,
    leavingChannel,
    deletingChannel,
    channelMembers,
    handleAddChannelMember,
    handleToggleChannelOverride,
    handleRemoveChannelMember,
    pinnedUserIds,
    canPinThreads,
    togglePinUser,
    conversationByUserId,
    presenceByUserId,
    activeConversation,
    handleSelectUser,
    messages,
    loadingMessages,
    loadingOlder,
    newMessageCount,
    jumpToLatest,
    messageListRef,
    handleMessageScroll,
    hoveredMessageId,
    setHoveredMessageId,
    reactionPickerMessageId,
    setReactionPickerMessageId,
    reactionDetailsOpenId,
    reactionDetailsByMessageId,
    reactionDetailsLoadingId,
    reactionDetailsTabByMessageId,
    setReactionDetailsTabByMessageId,
    replyReactionDetailsOpenId,
    replyReactionDetailsByReplyId,
    replyReactionDetailsLoadingId,
    replyReactionDetailsTabByReplyId,
    setReplyReactionDetailsTabByReplyId,
    editingMessageId,
    editingDraft,
    setEditingDraft,
    editingError,
    deleteMenuMessageId,
    setDeleteMenuMessageId,
    setDeleteConfirm,
    voiceUrls,
    attachmentPreviewUrls,
    openInlineReply,
    openReplyThread,
    openForwardPicker,
    startEditingMessage,
    cancelEditingMessage,
    handleSaveEdit,
    handleToggleMessageReaction,
    handleToggleReactionDetails,
    handleToggleReplyReactionDetails,
    setImagePreview,
    setVideoPreview,
    downloadThreadAttachment,
    downloadThreadReplyAttachment,
    inlineReplyTarget,
    setInlineReplyTarget,
    replyInlineTarget,
    setReplyInlineTarget,
    messageDraft,
    setMessageDraft,
    mentionMembers,
    handleMessageKeyDown,
    pendingAttachments,
    handleRemoveAttachment,
    fileInputRef,
    handleAttachmentChange,
    handlePickAttachments,
    sendError,
    recording,
    recordingDuration,
    cancelRecording,
    stopRecording,
    startRecording,
    sending,
    handleSendMessage,
    deleteConfirm,
    handleDeleteMessage,
    videoPreview,
    imagePreview,
    forwardOpen,
    forwardTarget,
    forwardSearch,
    setForwardSearch,
    filteredForwardUsers,
    forwarding,
    forwardError,
    closeForwardPicker,
    handleForwardToUser,
    showReplyPanel,
    replyOpen,
    replyTarget,
    replyPreviewExpanded,
    setReplyPreviewExpanded,
    replyAttachmentOpen,
    setReplyAttachmentOpen,
    replies,
    replyListRef,
    replyLoadingOlder,
    replyNewCount,
    handleReplyScroll,
    jumpToLatestReply,
    hoveredReplyId,
    setHoveredReplyId,
    reactionPickerReplyId,
    setReactionPickerReplyId,
    handleToggleReplyReaction,
    replyDraft,
    setReplyDraft,
    replyPendingAttachments,
    replyFileInputRef,
    handleReplyPickAttachments,
    handleReplyAttachmentChange,
    handleReplyRemoveAttachment,
    replyRecording,
    replyRecordingDuration,
    startReplyRecording,
    stopReplyRecording,
    cancelReplyRecording,
    editingReplyId,
    editingReplyDraft,
    setEditingReplyDraft,
    editingReplyError,
    startEditingReply,
    cancelEditingReply,
    handleSaveReplyEdit,
    replyDeleteConfirm,
    setReplyDeleteConfirm,
    handleDeleteReply,
    openInlineReplyForReply,
    openForwardPickerForReply,
    handleReplyKeyDown,
    replyError,
    handleSendReply,
    closeReplyThread
  } = useThreadsController();

  const [listOpen, setListOpen] = useState(false);
  const [showChannelSettings, setShowChannelSettings] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [deleteChannelConfirmOpen, setDeleteChannelConfirmOpen] = useState(false);

  const listToggleRef = useRef<HTMLButtonElement | null>(null);
  const listPanelRef = useRef<HTMLDivElement | null>(null);

  const isDm = activeConversation?.type === "dm";
  const isChannel = activeConversation?.type === "channel";
  const tabMentionTotal = activeTab === "channels" ? channelMentionTotal : dmMentionTotal;
  const channelSaveStatus =
    !canEditChannel
      ? "Read-only"
      : channelSaveState === "saving"
        ? "Saving changes..."
        : channelSaveState === "saved"
          ? "All changes saved"
          : channelSaveState === "error"
            ? "Unable to save changes"
            : "Autosave on";
  const channelSaveTone =
    !canEditChannel
      ? "text-muted-foreground"
      : channelSaveState === "error"
        ? "text-rose-500"
        : channelSaveState === "saved"
          ? "text-emerald-600"
          : "text-muted-foreground";

  const channelMemberIds = new Set(channelMembers.map((member) => member.user.id));
  const availableChannelUsers = dmUsers.filter((member) => !channelMemberIds.has(member.id));

  const handleTabChange = (tab: "dms" | "channels") => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  useEffect(() => {
    setShowChannelSettings(false);
  }, [activeConversation?.id, activeTab]);

  useEffect(() => {
    if (!listOpen) return;
    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (listToggleRef.current?.contains(target)) return;
      if (listPanelRef.current?.contains(target)) return;
      setListOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setListOpen(false);
      }
    };
    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [listOpen]);

  return (
    <div className="relative flex h-[calc(100vh-5.25rem)] flex-col overflow-hidden">
      <button
        ref={listToggleRef}
        type="button"
        onClick={() => setListOpen((open) => !open)}
        className="group absolute left-2 top-2 z-30 flex h-7 w-7 items-center justify-center rounded-full border border-border/70 bg-card/90 text-foreground shadow-sm transition hover:bg-card"
        aria-label={activeTab === "channels" ? "Toggle channels list" : "Toggle direct messages list"}
      >
        {activeTab === "channels" ? (
          <MessageSquareText className="h-4 w-4" />
        ) : (
          <Users className="h-4 w-4" />
        )}
        {tabMentionTotal > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {tabMentionTotal}
          </span>
        )}
      </button>

      <div
        ref={listPanelRef}
        className={`absolute left-3 top-14 z-20 w-72 transition-all duration-200 ${listOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none"}`}
      >
        <ThreadsSidebar
          activeTab={activeTab}
          dmMentionTotal={dmMentionTotal}
          channelMentionTotal={channelMentionTotal}
          onTabChange={handleTabChange}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          loading={loading}
          filteredDmUsers={filteredDmUsers}
          filteredChannels={filteredChannels}
          pinnedUserIds={pinnedUserIds}
          canPinThreads={canPinThreads}
          onTogglePinUser={togglePinUser}
          conversationByUserId={conversationByUserId}
          presenceByUserId={presenceByUserId}
          activeConversation={activeConversation}
          onSelectUser={handleSelectUser}
          onSelectChannel={handleSelectChannel}
          channelDraft={channelDraft}
          onChannelDraftChange={setChannelDraft}
          creatingChannel={creatingChannel}
          onCreateChannel={handleCreateChannel}
        />
      </div>

      <section className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-sm">
        {activeTab === "dms" && !isDm && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <Users className="h-10 w-10 text-muted-foreground" />
            Pick a teammate on the left to start a DM.
          </div>
        )}

        {activeTab === "channels" && !isChannel && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <MessageSquareText className="h-10 w-10 text-muted-foreground" />
            Pick or create a channel to start collaborating.
          </div>
        )}

        {isDm && activeTab === "dms" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="sticky top-0 z-0 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/95 pl-12 pr-4 py-2.5 backdrop-blur">
              <div className="text-sm">
                <span className="uppercase tracking-[0.2em] text-[10px] text-muted-foreground">Direct message</span>
                <span className="mx-2 text-xs text-muted-foreground">•</span>
                <span className="font-semibold">
                  {activeConversation.otherUser.displayName ?? activeConversation.otherUser.name}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">
                  @{activeConversation.otherUser.username ?? "username"}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquareText className="h-4 w-4" />
                {activeConversation.lastMessageAt
                  ? `Last message ${formatTimestamp(activeConversation.lastMessageAt)}`
                  : "No activity yet"}
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4">
              <ThreadMessageList
                messages={messages}
                loadingMessages={loadingMessages}
                loadingOlder={loadingOlder}
                currentUserId={user?.id}
                messageListRef={messageListRef}
                onScroll={handleMessageScroll}
                hoveredMessageId={hoveredMessageId}
                setHoveredMessageId={setHoveredMessageId}
                reactionPickerMessageId={reactionPickerMessageId}
                setReactionPickerMessageId={setReactionPickerMessageId}
                reactionDetailsOpenId={reactionDetailsOpenId}
                reactionDetailsByMessageId={reactionDetailsByMessageId}
                reactionDetailsLoadingId={reactionDetailsLoadingId}
                reactionDetailsTabByMessageId={reactionDetailsTabByMessageId}
                setReactionDetailsTabByMessageId={setReactionDetailsTabByMessageId}
                editingMessageId={editingMessageId}
                editingDraft={editingDraft}
                setEditingDraft={setEditingDraft}
                editingError={editingError}
                deleteMenuMessageId={deleteMenuMessageId}
                setDeleteMenuMessageId={setDeleteMenuMessageId}
                setDeleteConfirm={setDeleteConfirm}
                voiceUrls={voiceUrls}
                attachmentPreviewUrls={attachmentPreviewUrls}
                onOpenInlineReply={openInlineReply}
                onOpenReplyThread={openReplyThread}
                onOpenForwardPicker={openForwardPicker}
                onStartEditingMessage={startEditingMessage}
                onCancelEditingMessage={cancelEditingMessage}
                onSaveEdit={handleSaveEdit}
                onToggleMessageReaction={handleToggleMessageReaction}
                onToggleReactionDetails={handleToggleReactionDetails}
                onSetImagePreview={setImagePreview}
                onSetVideoPreview={setVideoPreview}
                onDownloadAttachment={downloadThreadAttachment}
              />

              {newMessageCount > 0 && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                    onClick={jumpToLatest}
                  >
                    +{newMessageCount} new messages
                  </button>
                </div>
              )}

              <ThreadComposer
                inlineReplyTarget={inlineReplyTarget}
                onCancelInlineReply={() => setInlineReplyTarget(null)}
                messageDraft={messageDraft}
                onMessageDraftChange={setMessageDraft}
                mentionMembers={mentionMembers}
                onMessageKeyDown={handleMessageKeyDown}
                pendingAttachments={pendingAttachments}
                onRemoveAttachment={handleRemoveAttachment}
                fileInputRef={fileInputRef}
                onAttachmentChange={handleAttachmentChange}
                onPickAttachments={handlePickAttachments}
                sendError={sendError}
                recording={recording}
                recordingDuration={recordingDuration}
                onCancelRecording={cancelRecording}
                onStopRecording={stopRecording}
                onStartRecording={startRecording}
                sending={sending}
                onSendMessage={handleSendMessage}
              />
            </div>
          </div>
        )}

        {isChannel && activeTab === "channels" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="sticky top-0 z-0 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/95 pl-12 pr-4 py-2.5 backdrop-blur">
              <div className="text-sm">
                <span className="uppercase tracking-[0.2em] text-[10px] text-muted-foreground">Channel</span>
                <span className="mx-2 text-xs text-muted-foreground">•</span>
                <button
                  type="button"
                  onClick={() => setShowChannelSettings((prev) => !prev)}
                  className="font-semibold text-foreground transition hover:text-primary"
                >
                  #{activeConversation.name}
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <MessageSquareText className="h-4 w-4" />
                {activeConversation.lastMessageAt
                  ? `Last message ${formatTimestamp(activeConversation.lastMessageAt)}`
                  : "No activity yet"}
              </div>
            </div>

            {showChannelSettings ? (
              <div className="flex min-h-0 flex-1 flex-col border-b border-border/60 bg-card/90">
                <div className="flex-1 overflow-y-auto px-4 py-4 text-xs">
                  <div className="rounded-xl border border-border/60 bg-background/70 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Channel details</p>
                    {canEditChannel ? (
                      <div className="mt-3 grid gap-3">
                        <label className="grid gap-1 text-[11px] font-semibold text-muted-foreground">
                          Channel name
                          <input
                            className="h-9 rounded-lg border border-border/60 bg-background/80 px-3 text-sm text-foreground outline-none"
                            value={channelNameDraft}
                            onChange={(event) => setChannelNameDraft(event.target.value)}
                          />
                        </label>
                        <label className="grid gap-1 text-[11px] font-semibold text-muted-foreground">
                          Description
                          <textarea
                            className="min-h-[88px] rounded-lg border border-border/60 bg-background/80 px-3 py-2 text-sm text-foreground outline-none"
                            value={channelDescriptionDraft}
                            onChange={(event) => setChannelDescriptionDraft(event.target.value)}
                          />
                        </label>
                        <div className="flex items-center justify-between">
                          <p className={`text-[11px] ${channelSaveTone}`}>{channelSaveStatus}</p>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 space-y-3 text-sm">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Channel name</p>
                          <p className="mt-1 font-semibold text-foreground">#{activeConversation.name}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Description</p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            {activeConversation.description?.trim() ? activeConversation.description : "No description yet."}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>

                  {canManageChannel ? (
                    <div className="mt-4 rounded-xl border border-border/60 bg-background/70 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Members & permissions</p>
                      <div className="mt-3 space-y-2">
                        {channelMembers.length === 0 && (
                          <p className="text-xs text-muted-foreground">No members yet.</p>
                        )}
                        {channelMembers.map((member) => {
                          const readOverride = member.overrides.some(
                            (override) => override.permission === "channel_read" && override.access === "allow"
                          );
                          const writeOverride = member.overrides.some(
                            (override) => override.permission === "channel_write" && override.access === "allow"
                          );
                          const editOverride = member.overrides.some(
                            (override) => override.permission === "channel_edit" && override.access === "allow"
                          );
                          const addOverride = member.overrides.some(
                            (override) => override.permission === "channel_members_add" && override.access === "allow"
                          );
                          const removeOverride = member.overrides.some(
                            (override) => override.permission === "channel_members_remove" && override.access === "allow"
                          );
                          const manageOverride = member.overrides.some(
                            (override) => override.permission === "channel_manage_overrides" && override.access === "allow"
                          );
                          const deleteOverride = member.overrides.some(
                            (override) => override.permission === "channel_delete" && override.access === "allow"
                          );
                          const showOverrideControls = canManageChannelOverrides;
                          const showRemove = canRemoveChannelMembers;
                          return (
                            <div
                              key={member.user.id}
                              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                            >
                              <div>
                                <p className="text-sm font-semibold">
                                  {member.user.displayName ?? member.user.name}
                                </p>
                                <p className="text-[11px] text-muted-foreground">@{member.user.username ?? "user"}</p>
                              </div>
                              <div className="flex flex-wrap items-center gap-3">
                                {showOverrideControls ? (
                                  <>
                                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <input
                                        type="checkbox"
                                        className="h-3 w-3 accent-primary"
                                        checked={readOverride}
                                        onChange={(event) =>
                                          handleToggleChannelOverride(member.user.id, "channel_read", event.target.checked)
                                        }
                                      />
                                      View messages
                                    </label>
                                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <input
                                        type="checkbox"
                                        className="h-3 w-3 accent-primary"
                                        checked={writeOverride}
                                        onChange={(event) =>
                                          handleToggleChannelOverride(member.user.id, "channel_write", event.target.checked)
                                        }
                                      />
                                      Send messages
                                    </label>
                                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <input
                                        type="checkbox"
                                        className="h-3 w-3 accent-primary"
                                        checked={editOverride}
                                        onChange={(event) =>
                                          handleToggleChannelOverride(member.user.id, "channel_edit", event.target.checked)
                                        }
                                      />
                                      Edit channel
                                    </label>
                                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <input
                                        type="checkbox"
                                        className="h-3 w-3 accent-primary"
                                        checked={addOverride}
                                        onChange={(event) =>
                                          handleToggleChannelOverride(member.user.id, "channel_members_add", event.target.checked)
                                        }
                                      />
                                      Add members
                                    </label>
                                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <input
                                        type="checkbox"
                                        className="h-3 w-3 accent-primary"
                                        checked={removeOverride}
                                        onChange={(event) =>
                                          handleToggleChannelOverride(member.user.id, "channel_members_remove", event.target.checked)
                                        }
                                      />
                                      Remove members
                                    </label>
                                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <input
                                        type="checkbox"
                                        className="h-3 w-3 accent-primary"
                                        checked={manageOverride}
                                        onChange={(event) =>
                                          handleToggleChannelOverride(member.user.id, "channel_manage_overrides", event.target.checked)
                                        }
                                      />
                                      Manage overrides
                                    </label>
                                    <label className="flex items-center gap-1 text-[11px] text-muted-foreground">
                                      <input
                                        type="checkbox"
                                        className="h-3 w-3 accent-primary"
                                        checked={deleteOverride}
                                        onChange={(event) =>
                                          handleToggleChannelOverride(member.user.id, "channel_delete", event.target.checked)
                                        }
                                      />
                                      Delete channel
                                    </label>
                                  </>
                                ) : (
                                  <div className="text-[11px] text-muted-foreground">
                                    <span className="font-semibold text-foreground">
                                      {member.role === "admin" ? "Admin" : "Member"}
                                    </span>
                                    <span className="mx-1 text-muted-foreground/70">•</span>
                                    {member.effectivePermissions.channel_read ? "Can view" : "No view"}
                                    <span className="mx-1 text-muted-foreground/70">•</span>
                                    {member.effectivePermissions.channel_write ? "Can send" : "View only"}
                                  </div>
                                )}
                                {showRemove && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveChannelMember(member.user.id)}
                                    className="rounded-full border border-border/60 px-2 py-1 text-[11px] text-muted-foreground transition hover:border-rose-400/60 hover:text-rose-500"
                                  >
                                    Remove
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {canAddChannelMembers && (
                        <div className="mt-4">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Add member</p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {availableChannelUsers.length === 0 && (
                              <span className="text-xs text-muted-foreground">Everyone is already in this channel.</span>
                            )}
                            {availableChannelUsers.map((member) => (
                              <button
                                key={member.id}
                                type="button"
                                onClick={() => handleAddChannelMember(member.id)}
                                className="rounded-full border border-border/60 bg-background/70 px-3 py-1 text-xs text-foreground transition hover:border-primary/40 hover:bg-primary/5"
                              >
                                + {member.displayName ?? member.name}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-border/60 bg-background/70 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Members</p>
                      <div className="mt-3 space-y-2">
                        {channelMembers.length === 0 && (
                          <p className="text-xs text-muted-foreground">No members yet.</p>
                        )}
                        {channelMembers.map((member) => (
                          <div
                            key={member.user.id}
                            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-background/70 px-3 py-2"
                          >
                            <div>
                              <p className="text-sm font-semibold">
                                {member.user.displayName ?? member.user.name}
                              </p>
                              <p className="text-[11px] text-muted-foreground">@{member.user.username ?? "user"}</p>
                            </div>
                            <span className="rounded-full border border-border/60 px-2 py-0.5 text-[11px] text-muted-foreground">
                              {member.role === "admin" ? "Admin" : "Member"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 rounded-xl border border-rose-200/50 bg-rose-50/60 p-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-600">Leave channel</p>
                    <p className="mt-2 text-xs text-rose-700/80">You will lose access to this channel until someone adds you back.</p>
                    <div className="mt-3 flex justify-end">
                      <button
                        type="button"
                        onClick={() => setLeaveConfirmOpen(true)}
                        disabled={leavingChannel}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                          leavingChannel
                            ? "cursor-not-allowed border border-rose-200/50 bg-rose-100/40 text-rose-400"
                            : "border border-rose-300/70 bg-rose-100/70 text-rose-700 hover:bg-rose-200/70"
                        }`}
                      >
                        {leavingChannel ? "Leaving" : "Leave channel"}
                      </button>
                    </div>
                  </div>

                  {canDeleteChannel && (
                    <div className="mt-4 rounded-xl border border-rose-200/50 bg-rose-50/60 p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-600">Delete channel</p>
                      <p className="mt-2 text-xs text-rose-700/80">Deleting will remove this channel and its history for everyone.</p>
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => setDeleteChannelConfirmOpen(true)}
                          disabled={deletingChannel}
                          className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                            deletingChannel
                              ? "cursor-not-allowed border border-rose-200/50 bg-rose-100/40 text-rose-400"
                              : "border border-rose-300/70 bg-rose-100/70 text-rose-700 hover:bg-rose-200/70"
                          }`}
                        >
                          {deletingChannel ? "Deleting" : "Delete channel"}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-0 flex-1 flex-col gap-4 px-4 py-4">
                <ThreadMessageList
                  messages={messages}
                  loadingMessages={loadingMessages}
                  loadingOlder={loadingOlder}
                  currentUserId={user?.id}
                  messageListRef={messageListRef}
                  onScroll={handleMessageScroll}
                  hoveredMessageId={hoveredMessageId}
                  setHoveredMessageId={setHoveredMessageId}
                  reactionPickerMessageId={reactionPickerMessageId}
                  setReactionPickerMessageId={setReactionPickerMessageId}
                  reactionDetailsOpenId={reactionDetailsOpenId}
                  reactionDetailsByMessageId={reactionDetailsByMessageId}
                  reactionDetailsLoadingId={reactionDetailsLoadingId}
                  reactionDetailsTabByMessageId={reactionDetailsTabByMessageId}
                  setReactionDetailsTabByMessageId={setReactionDetailsTabByMessageId}
                  editingMessageId={editingMessageId}
                  editingDraft={editingDraft}
                  setEditingDraft={setEditingDraft}
                  editingError={editingError}
                  deleteMenuMessageId={deleteMenuMessageId}
                  setDeleteMenuMessageId={setDeleteMenuMessageId}
                  setDeleteConfirm={setDeleteConfirm}
                  voiceUrls={voiceUrls}
                  attachmentPreviewUrls={attachmentPreviewUrls}
                  onOpenInlineReply={openInlineReply}
                  onOpenReplyThread={openReplyThread}
                  onOpenForwardPicker={openForwardPicker}
                  onStartEditingMessage={startEditingMessage}
                  onCancelEditingMessage={cancelEditingMessage}
                  onSaveEdit={handleSaveEdit}
                  onToggleMessageReaction={handleToggleMessageReaction}
                  onToggleReactionDetails={handleToggleReactionDetails}
                  onSetImagePreview={setImagePreview}
                  onSetVideoPreview={setVideoPreview}
                  onDownloadAttachment={downloadThreadAttachment}
                />

                {newMessageCount > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-500"
                      onClick={jumpToLatest}
                    >
                      +{newMessageCount} new messages
                    </button>
                  </div>
                )}

                <ThreadComposer
                  inlineReplyTarget={inlineReplyTarget}
                  onCancelInlineReply={() => setInlineReplyTarget(null)}
                  messageDraft={messageDraft}
                  onMessageDraftChange={setMessageDraft}
                  mentionMembers={mentionMembers}
                  onMessageKeyDown={handleMessageKeyDown}
                  pendingAttachments={pendingAttachments}
                  onRemoveAttachment={handleRemoveAttachment}
                  fileInputRef={fileInputRef}
                  onAttachmentChange={handleAttachmentChange}
                  onPickAttachments={handlePickAttachments}
                  sendError={sendError}
                  recording={recording}
                  recordingDuration={recordingDuration}
                  onCancelRecording={cancelRecording}
                  onStopRecording={stopRecording}
                  onStartRecording={startRecording}
                  sending={sending}
                  onSendMessage={handleSendMessage}
                />
              </div>
            )}
          </div>
        )}

        <ConfirmDialog
          open={Boolean(deleteConfirm)}
          title={deleteConfirm?.scope === "all" ? "Delete for everyone?" : "Delete for you?"}
          description={
            deleteConfirm?.scope === "all"
              ? "This will remove the message for everyone if it hasn’t been seen yet."
              : "This will hide the message only for you."
          }
          confirmLabel={deleteConfirm?.scope === "all" ? "Delete for all" : "Delete for me"}
          confirmClassName={
            deleteConfirm?.scope === "all"
              ? "bg-rose-500/90 text-white hover:bg-rose-500"
              : "bg-amber-500/90 text-white hover:bg-amber-500"
          }
          onConfirm={() => {
            if (!deleteConfirm) return;
            void handleDeleteMessage(deleteConfirm.message, deleteConfirm.scope);
            setDeleteConfirm(null);
          }}
          onCancel={() => setDeleteConfirm(null)}
        />

        <ConfirmDialog
          open={Boolean(replyDeleteConfirm)}
          title={replyDeleteConfirm?.scope === "all" ? "Delete reply for everyone?" : "Delete reply for you?"}
          description={
            replyDeleteConfirm?.scope === "all"
              ? "This will remove the reply for everyone."
              : "This will hide the reply only for you."
          }
          confirmLabel={replyDeleteConfirm?.scope === "all" ? "Delete reply for all" : "Delete reply for me"}
          confirmClassName={
            replyDeleteConfirm?.scope === "all"
              ? "bg-rose-500/90 text-white hover:bg-rose-500"
              : "bg-amber-500/90 text-white hover:bg-amber-500"
          }
          onConfirm={() => {
            if (!replyDeleteConfirm) return;
            void handleDeleteReply(replyDeleteConfirm.reply, replyDeleteConfirm.scope);
            setReplyDeleteConfirm(null);
          }}
          onCancel={() => setReplyDeleteConfirm(null)}
        />


        <ConfirmDialog
          open={leaveConfirmOpen}
          title="Leave channel?"
          description="You will lose access to this channel until someone adds you back."
          confirmLabel="Leave channel"
          confirmClassName="bg-rose-500/90 text-white hover:bg-rose-500"
          onConfirm={() => {
            setLeaveConfirmOpen(false);
            void handleLeaveChannel();
          }}
          onCancel={() => setLeaveConfirmOpen(false)}
        />

        
        <ConfirmDialog
          open={deleteChannelConfirmOpen}
          title="Delete channel?"
          description="This will permanently remove the channel for everyone."
          confirmLabel="Delete channel"
          confirmClassName="bg-rose-500/90 text-white hover:bg-rose-500"
          onConfirm={() => {
            setDeleteChannelConfirmOpen(false);
            void handleDeleteChannel();
          }}
          onCancel={() => setDeleteChannelConfirmOpen(false)}
        />

        <ThreadMediaPreviews
          videoPreview={videoPreview}
          imagePreview={imagePreview}
          onCloseVideo={() => setVideoPreview(null)}
          onCloseImage={() => setImagePreview(null)}
        />

        <ThreadsForwardModal
          open={forwardOpen}
          forwardTarget={forwardTarget}
          forwardSearch={forwardSearch}
          onForwardSearchChange={setForwardSearch}
          filteredForwardUsers={filteredForwardUsers}
          forwarding={forwarding}
          forwardError={forwardError}
          onClose={closeForwardPicker}
          onSelectUser={handleForwardToUser}
        />

        <ThreadsReplyDrawer
          open={showReplyPanel}
          replyOpen={replyOpen}
          replyTarget={replyTarget}
          replyPreviewExpanded={replyPreviewExpanded}
          onToggleReplyPreview={() => setReplyPreviewExpanded((prev) => !prev)}
          replyAttachmentOpen={replyAttachmentOpen}
          onToggleReplyAttachments={() => setReplyAttachmentOpen((prev) => !prev)}
          replies={replies}
          replyListRef={replyListRef}
          replyLoadingOlder={replyLoadingOlder}
          replyNewCount={replyNewCount}
          onReplyScroll={handleReplyScroll}
          onJumpToLatestReply={jumpToLatestReply}
          currentUserId={user?.id}
          voiceUrls={voiceUrls}
          attachmentPreviewUrls={attachmentPreviewUrls}
          onSetImagePreview={setImagePreview}
          onSetVideoPreview={setVideoPreview}
          hoveredReplyId={hoveredReplyId}
          setHoveredReplyId={setHoveredReplyId}
          reactionPickerReplyId={reactionPickerReplyId}
          setReactionPickerReplyId={setReactionPickerReplyId}
          replyReactionDetailsOpenId={replyReactionDetailsOpenId}
          replyReactionDetailsByReplyId={replyReactionDetailsByReplyId}
          replyReactionDetailsLoadingId={replyReactionDetailsLoadingId}
          replyReactionDetailsTabByReplyId={replyReactionDetailsTabByReplyId}
          setReplyReactionDetailsTabByReplyId={setReplyReactionDetailsTabByReplyId}
          onToggleReplyReaction={handleToggleReplyReaction}
          onToggleReplyReactionDetails={handleToggleReplyReactionDetails}
          onDownloadReplyAttachment={downloadThreadReplyAttachment}
          onOpenInlineReply={openInlineReplyForReply}
          onOpenForwardPicker={openForwardPickerForReply}
          editingReplyId={editingReplyId}
          editingReplyDraft={editingReplyDraft}
          setEditingReplyDraft={setEditingReplyDraft}
          editingReplyError={editingReplyError}
          onStartEditingReply={startEditingReply}
          onCancelEditingReply={cancelEditingReply}
          onSaveReplyEdit={handleSaveReplyEdit}
          onRequestDeleteReply={setReplyDeleteConfirm}
          replyDraft={replyDraft}
          onReplyDraftChange={setReplyDraft}
          replyInlineTarget={replyInlineTarget}
          onCancelReplyInline={() => setReplyInlineTarget(null)}
          replyPendingAttachments={replyPendingAttachments}
          replyFileInputRef={replyFileInputRef}
          onReplyPickAttachments={handleReplyPickAttachments}
          onReplyAttachmentChange={handleReplyAttachmentChange}
          onReplyRemoveAttachment={handleReplyRemoveAttachment}
          replyRecording={replyRecording}
          replyRecordingDuration={replyRecordingDuration}
          onReplyStartRecording={startReplyRecording}
          onReplyStopRecording={stopReplyRecording}
          onReplyCancelRecording={cancelReplyRecording}
          mentionMembers={mentionMembers}
          onReplyKeyDown={handleReplyKeyDown}
          replyError={replyError}
          onSendReply={handleSendReply}
          onClose={closeReplyThread}
        />
      </section>
    </div>
  );
}

































