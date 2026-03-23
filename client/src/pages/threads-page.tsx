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
    activeTab,
    totalMentions,
    searchTerm,
    setSearchTerm,
    loading,
    filteredDmUsers,
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

  const listToggleRef = useRef<HTMLButtonElement | null>(null);
  const listPanelRef = useRef<HTMLDivElement | null>(null);

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
        {totalMentions > 0 && (
          <span className="absolute -right-1 -top-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
            {totalMentions}
          </span>
        )}
      </button>

      <div
        ref={listPanelRef}
        className={`absolute left-3 top-14 z-20 w-72 transition-all duration-200 ${listOpen ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0 pointer-events-none"}`}
      >
        <ThreadsSidebar
          activeTab={activeTab}
          searchTerm={searchTerm}
          onSearchTermChange={setSearchTerm}
          loading={loading}
          filteredDmUsers={filteredDmUsers}
          pinnedUserIds={pinnedUserIds}
          canPinThreads={canPinThreads}
          onTogglePinUser={togglePinUser}
          conversationByUserId={conversationByUserId}
          presenceByUserId={presenceByUserId}
          activeConversation={activeConversation}
          onSelectUser={handleSelectUser}
        />
      </div>

      <section className="relative flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-border/70 bg-card/60 shadow-sm">
        {!activeConversation && activeTab === "dms" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <Users className="h-10 w-10 text-muted-foreground" />
            Pick a teammate on the left to start a DM.
          </div>
        )}

        {activeTab === "channels" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-sm text-muted-foreground">
            <MessageSquareText className="h-10 w-10 text-muted-foreground" />
            Channels are on the way. For now, keep using DMs.
          </div>
        )}

        {activeConversation && activeTab === "dms" && (
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
