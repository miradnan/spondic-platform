/**
 * Walkthrough system using driver.js.
 *
 * Each page defines its own steps. A walkthrough auto-starts once when the
 * user first visits a page (tracked in localStorage). Users can also
 * re-trigger any walkthrough from a "?" help button.
 */

import { useEffect, useCallback, useRef } from "react";
import { driver, type DriveStep, type Config } from "driver.js";
import "driver.js/dist/driver.css";

// ── Storage helpers ──────────────────────────────────────────────────────────

const STORAGE_PREFIX = "spondic_walkthrough_";

function hasSeenWalkthrough(key: string): boolean {
  try {
    return localStorage.getItem(`${STORAGE_PREFIX}${key}`) === "done";
  } catch {
    return false;
  }
}

function markWalkthroughDone(key: string) {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${key}`, "done");
  } catch {
    // localStorage unavailable — silently ignore
  }
}

export function resetWalkthrough(key: string) {
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${key}`);
  } catch {
    // ignore
  }
}

export function resetAllWalkthroughs() {
  try {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(STORAGE_PREFIX))
      .forEach((k) => localStorage.removeItem(k));
  } catch {
    // ignore
  }
}

// ── Shared driver config ─────────────────────────────────────────────────────

const BASE_CONFIG: Partial<Config> = {
  showProgress: true,
  animate: true,
  smoothScroll: true,
  allowClose: true,
  overlayColor: "rgba(26, 39, 64, 0.6)", // navy with opacity
  stagePadding: 8,
  stageRadius: 12,
  popoverClass: "spondic-tour-popover",
  nextBtnText: "Next",
  prevBtnText: "Back",
  doneBtnText: "Got it!",
};

// ── Hook ─────────────────────────────────────────────────────────────────────

interface UseWalkthroughOptions {
  /** Unique key for this walkthrough (used in localStorage). */
  key: string;
  /** Steps for driver.js. */
  steps: DriveStep[];
  /** Delay in ms before auto-starting (default 800). */
  delay?: number;
  /** If true, auto-start even if the user has seen it before. */
  force?: boolean;
}

export function useWalkthrough({
  key,
  steps,
  delay = 800,
  force = false,
}: UseWalkthroughOptions) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  // Auto-start on first visit
  useEffect(() => {
    if (!force && hasSeenWalkthrough(key)) return;
    if (steps.length === 0) return;

    const timeout = setTimeout(() => {
      // Only start if the first step's element exists in the DOM
      const firstEl = steps[0].element;
      if (typeof firstEl === "string" && !document.querySelector(firstEl)) return;

      const d = driver({
        ...BASE_CONFIG,
        steps,
        onDestroyStarted: () => {
          markWalkthroughDone(key);
          d.destroy();
        },
      });
      driverRef.current = d;
      d.drive();
    }, delay);

    return () => {
      clearTimeout(timeout);
      driverRef.current?.destroy();
    };
  }, [key, steps, delay, force]);

  // Manual trigger
  const start = useCallback(() => {
    driverRef.current?.destroy();
    const d = driver({
      ...BASE_CONFIG,
      steps,
      onDestroyStarted: () => {
        markWalkthroughDone(key);
        d.destroy();
      },
    });
    driverRef.current = d;
    d.drive();
  }, [key, steps]);

  return { start };
}

// ── Pre-built walkthrough step sets ──────────────────────────────────────────

export const DASHBOARD_STEPS: DriveStep[] = [
  {
    element: '[data-tour="sidebar-nav"]',
    popover: {
      title: "Navigation",
      description:
        "Use the sidebar to move between your dashboard, knowledge base, AI chat, and analytics.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="create-project"]',
    popover: {
      title: "Create Your First RFP",
      description:
        "Click here to start a new proposal. Upload an RFP document and let AI extract questions and draft answers.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="onboarding-checklist"]',
    popover: {
      title: "Getting Started Checklist",
      description:
        "Follow these three steps to get the most out of Spondic: upload documents, create an RFP, and review AI-drafted answers.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="search-filter"]',
    popover: {
      title: "Search & Filter",
      description:
        "Quickly find proposals by name or filter by status. Switch between card and table views.",
      side: "bottom",
      align: "start",
    },
  },
];

export const KNOWLEDGE_BASE_STEPS: DriveStep[] = [
  {
    element: '[data-tour="upload-docs"]',
    popover: {
      title: "Upload Your Documents",
      description:
        "Start by uploading past RFP responses, proposals, compliance docs, and product sheets. These power the AI's answers.",
      side: "bottom",
      align: "end",
    },
  },
  {
    element: '[data-tour="doc-search"]',
    popover: {
      title: "Semantic Search",
      description:
        "Search your knowledge base using natural language. The AI finds relevant content even if the exact words don't match.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="doc-tags"]',
    popover: {
      title: "Organize with Tags",
      description:
        "Tag documents by category (security, compliance, product, etc.) to keep your knowledge base organized.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="doc-table"]',
    popover: {
      title: "Your Document Library",
      description:
        "All uploaded documents appear here with their processing status. Once indexed, they're ready for AI-powered answering.",
      side: "top",
      align: "start",
    },
  },
];

export const RFP_NEW_STEPS: DriveStep[] = [
  {
    element: '[data-tour="rfp-name"]',
    popover: {
      title: "Name Your Proposal",
      description:
        "Give your proposal a descriptive name so your team can easily find it later.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="rfp-deadline"]',
    popover: {
      title: "Set a Deadline",
      description:
        "Add the submission deadline. Spondic will show urgency indicators and alert you as the deadline approaches.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="rfp-upload"]',
    popover: {
      title: "Upload Your RFP",
      description:
        "Drag and drop the RFP document here, or click to browse. Supported formats: PDF, Word, Excel, PowerPoint.",
      side: "top",
      align: "center",
    },
  },
  {
    element: '[data-tour="rfp-paste"]',
    popover: {
      title: "Or Paste Text",
      description:
        "If you received the RFP as text (email, spreadsheet), you can paste the questions directly here instead of uploading a file.",
      side: "top",
      align: "center",
    },
  },
];

export const RFP_VIEW_STEPS: DriveStep[] = [
  {
    element: '[data-tour="rfp-parse"]',
    popover: {
      title: "Step 1: Parse the RFP",
      description:
        "Click 'Parse RFP' to let AI extract all questions, requirements, and sections from your uploaded document.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="rfp-draft"]',
    popover: {
      title: "Step 2: Draft Answers",
      description:
        "Once questions are extracted, click 'Draft All' to generate AI-powered answers from your knowledge base. Each answer includes source citations.",
      side: "bottom",
      align: "start",
    },
  },
  {
    element: '[data-tour="rfp-tabs"]',
    popover: {
      title: "Review & Export",
      description:
        "Switch between tabs to review questions, edit and approve answers, and export the final response as PDF or Word.",
      side: "bottom",
      align: "center",
    },
  },
];

export const CHAT_STEPS: DriveStep[] = [
  {
    element: '[data-tour="chat-prompts"]',
    popover: {
      title: "Suggested Prompts",
      description:
        "Click any suggested prompt to quickly ask common questions about your knowledge base.",
      side: "bottom",
      align: "center",
    },
  },
  {
    element: '[data-tour="chat-input"]',
    popover: {
      title: "Ask Anything",
      description:
        "Type a question about your documents. The AI will search your knowledge base and provide cited answers in real-time.",
      side: "top",
      align: "center",
    },
  },
];
