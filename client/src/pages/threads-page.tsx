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
    searchTerm,
    setSearchTerm,
    loading,
    filteredDmUsers,
    conversationByUserId,
    presenceByUserId,
    activeConversation,
    handleSelectUser,
    messages,
    loadingMessages,
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
    setImagePreview,
    setVideoPreview,
    downloadThreadAttachment,
    inlineReplyTarget,
    setInlineReplyTarget,
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
    hoveredReplyId,
    setHoveredReplyId,
    reactionPickerReplyId,
    setReactionPickerReplyId,
    handleToggleReplyReaction,
    replyDraft,
    setReplyDraft,
    handleReplyKeyDown,
    replyError,
    handleSendReply,
    closeReplyThread
  } = useThreadsController();

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4 overflow-hidden lg:flex-row">
            <ThreadsSidebar
        activeTab={activeTab}
        totalMentions={totalMentions}
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        onSelectTab={(tab) => setSearchParams({ tab })}
        loading={loading}
        filteredDmUsers={filteredDmUsers}
        conversationByUserId={conversationByUserId}
        presenceByUserId={presenceByUserId}
        activeConversation={activeConversation}
        onSelectUser={handleSelectUser}
      />


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
            <div className="sticky top-0 z-0 flex flex-wrap items-center justify-between gap-3 border-b border-border/60 bg-card/95 px-4 py-3 backdrop-blur">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Direct message</p>
                <h3 className="text-lg font-semibold">
                    {activeConversation.otherUser.displayName ?? activeConversation.otherUser.name}
                  </h3>
                <p className="text-xs text-muted-foreground">@{activeConversation.otherUser.username ?? "username"}</p>
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
          currentUserId={user?.id}
          voiceUrls={voiceUrls}
          hoveredReplyId={hoveredReplyId}
          setHoveredReplyId={setHoveredReplyId}
          reactionPickerReplyId={reactionPickerReplyId}
          setReactionPickerReplyId={setReactionPickerReplyId}
          onToggleReplyReaction={handleToggleReplyReaction}
          onDownloadAttachment={downloadThreadAttachment}
          replyDraft={replyDraft}
          onReplyDraftChange={setReplyDraft}
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
