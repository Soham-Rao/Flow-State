import { Button } from "@/components/ui/button";

type MediaPreview = { url: string; name: string } | null;

type ThreadMediaPreviewsProps = {
  videoPreview: MediaPreview;
  imagePreview: MediaPreview;
  onCloseVideo: () => void;
  onCloseImage: () => void;
};

export function ThreadMediaPreviews({
  videoPreview,
  imagePreview,
  onCloseVideo,
  onCloseImage
}: ThreadMediaPreviewsProps): JSX.Element {
  return (
    <>
      {videoPreview && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-background/60" onClick={onCloseVideo} />
          <div className="absolute left-1/2 top-1/2 w-[84vw] max-w-2xl max-h-[72vh] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border/70 bg-card/95 p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Video preview</p>
              <Button variant="ghost" size="sm" onClick={onCloseVideo}>
                Close
              </Button>
            </div>
            <div className="mt-3">
              <video src={videoPreview.url} controls className="max-h-[52vh] w-full rounded-lg object-contain" />
              <p className="mt-2 text-xs text-muted-foreground">{videoPreview.name}</p>
            </div>
          </div>
        </div>
      )}

      {imagePreview && (
        <div className="absolute inset-0 z-40">
          <div className="absolute inset-0 bg-background/60" onClick={onCloseImage} />
          <div className="absolute left-1/2 top-1/2 w-[84vw] max-w-2xl max-h-[72vh] -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border/70 bg-card/95 p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Image preview</p>
              <Button variant="ghost" size="sm" onClick={onCloseImage}>
                Close
              </Button>
            </div>
            <div className="mt-3">
              <img src={imagePreview.url} alt={imagePreview.name} className="max-h-[52vh] w-full rounded-lg object-contain" />
              <p className="mt-2 text-xs text-muted-foreground">{imagePreview.name}</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
