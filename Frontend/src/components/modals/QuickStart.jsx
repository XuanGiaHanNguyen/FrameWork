import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog";
import { Button } from "../../components/ui/button";
import {
  Upload,
  User,
  FileText,
  ImageIcon,
  Video,
  ArrowRight,
  Cable,
  Play,
  Download,
  Workflow,
} from "lucide-react";

const QUICKSTART_KEY = "ugc-quickstart-seen";

const STEPS = [
  {
    icon: Upload,
    title: "Upload Product",
    subtitle: "Product Upload node",
    description:
      "Drag a Product Upload node onto the canvas. Click it to upload your product image (PNG/JPG) and enter the product name. This image is what the AI creator will hold.",
    tips: [
      "Use a clean, well-lit product photo on a plain background",
      "Square or portrait crops work best for vertical videos",
    ],
  },
  {
    icon: User,
    title: "Configure AI Creator",
    subtitle: "UGC Model node",
    description:
      "Add a UGC Model node and configure the AI persona. Pick gender, ethnicity, and age range to match your target audience. Optionally add a description for more specific appearance.",
    tips: [
      "Match the creator persona to your brand demographic",
      "The description field lets you specify details like hair color or clothing",
    ],
  },
  {
    icon: FileText,
    title: "Write the Script",
    subtitle: "Script node",
    description:
      "Add a Script node and write the short dialogue your AI creator will speak on camera. The character counter helps you stay within the video duration limit.",
    tips: [
      "Keep scripts under 120 characters for 8-second videos",
      "Write naturally -- contractions and casual tone feel more authentic",
    ],
  },
  {
    icon: ImageIcon,
    title: "Generate Image",
    subtitle: "Image Generation node (Flux Edit)",
    description:
      "Add an Image Generation node. This uses Flux Edit models to composite your product into the AI creator's hands, generating a photorealistic still frame.",
    tips: [
      "Flux 2 Pro Edit gives the highest quality results",
      "The generated image becomes the first frame of your video",
    ],
  },
  {
    icon: Cable,
    title: "Connect the Nodes",
    subtitle: "Drag edges between handles",
    description:
      "Wire the nodes together by dragging from output handles to input handles. Product Upload and UGC Model both feed into Image Generation. Script and the generated image both feed into Video Generation.",
    tips: [
      "Use a template from the Templates menu to auto-wire a complete flow",
      "Colored handles indicate compatible connection types",
    ],
  },
  {
    icon: Video,
    title: "Generate Video",
    subtitle: "Video Generation node (Veo 3.1)",
    description:
      "Add a Video Generation node. Veo 3.1 animates your still image into a UGC video with natural lip-sync, head movement, and hand gestures from your script.",
    tips: [
      "9:16 vertical is ideal for Reels, TikTok, and Shorts",
      "8-second duration balances quality with generation speed",
    ],
  },
  {
    icon: Play,
    title: "Run the Workflow",
    subtitle: "Click the Run button",
    description:
      "Hit the Run button in the top bar. The workflow executes node by node -- you can watch each node light up green as it completes. The execution panel on the right shows live progress and logs.",
    tips: [
      "Image generation takes ~15-30 seconds, video takes ~1-3 minutes",
      "If a node fails, check the error message and re-run from that point",
    ],
  },
  {
    icon: Download,
    title: "Preview & Download",
    subtitle: "View results in each node",
    description:
      "Once complete, the generated image appears in the Image node and the final video plays in the Video node. Click the output to preview full-size, or use the Export Code button to get production-ready API code.",
    tips: [
      "Right-click the video to save it directly",
      "Export Code generates a Next.js API route you can deploy",
    ],
  },
];

export function QuickstartModal({ open = false, onClose, onStartBuilding }) {
  const [step, setStep] = useState(0);

  const handleClose = () => {
    onClose?.();
    sessionStorage.setItem(QUICKSTART_KEY, "true");
  };

  const handleOpenChange = (value) => {
    if (!value) handleClose();
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      onStartBuilding?.();
      handleClose();
    }
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const current = STEPS[step];
  const Icon = current.icon;
  const isLast = step === STEPS.length - 1;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-xl gap-0 p-0 overflow-hidden bg-white rounded-lg">
        {/* Header */}
        <DialogHeader className="bg-white px-7 pt-7">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-neutral-300 bg-neutral-100">
              <Workflow className="h-4.5 w-4.5 text-neutral-600" />
            </div>
            <div>
              <DialogTitle className="text-lg">How it works</DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground mt-0.5">
                Build a UGC product video in {STEPS.length} steps
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Step progress bar */}
        <div className="flex gap-1.5 px-7 pb-5">
          {STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 flex-1 bg-neutral-100 rounded-full transition-all duration-300 ${
                i === step
                  ? "bg-neutral-600"
                  : i < step
                    ? "bg-neutral-300"
                    : "bg-border"
              }`}
              aria-label={`Go to step ${i + 1}`}
            />
          ))}
        </div>

        {/* Active step content */}
        <div className="px-7 pb-5 pt-1">
          <div className="rounded-lg border border-neutral-100 bg-neutral-50 p-5">
            {/* Step number + title row */}
            <div className="flex items-center gap-3.5 mb-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-neutral-600 text-neutral-100 text-sm font-bold">
                {step + 1}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-base font-semibold text-foreground">
                    {current.title}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {current.subtitle}
                </p>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-muted-foreground leading-relaxed">
              {current.description}
            </p>
          </div>
        </div>

        {/* Footer */}
        <DialogFooter className="border-t border-neutral-200 px-7 py-4 bg-white">
          <div className="flex w-full items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="text-sm text-muted-foreground h-9"
              onClick={handleClose}
            >
              Skip tour
            </Button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground tabular-nums mr-1">
                {step + 1} / {STEPS.length}
              </span>
              {step > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-sm h-9 px-3.5"
                  onClick={handleBack}
                >
                  Back
                </Button>
              )}
              <Button
                size="sm"
                className="text-sm h-9 px-5"
                onClick={handleNext}
              >
                {isLast ? "Start building" : "Next"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
