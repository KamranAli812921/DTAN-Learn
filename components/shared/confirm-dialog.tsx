"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/**
 * Shared confirmation dialog for destructive actions (spec 8: "Confirmation
 * dialogs before destructive actions"). Render it once and drive it via the
 * returned `confirm()` promise, e.g.:
 *   const { confirm, dialog } = useConfirm();
 *   const ok = await confirm({ title: "Deactivate student?", description: "..." });
 */
export function useConfirm() {
  const [state, setState] = useState<{
    open: boolean;
    title: string;
    description?: string;
    confirmLabel?: string;
    variant?: "default" | "destructive";
    resolve?: (v: boolean) => void;
  }>({ open: false, title: "" });

  function confirm(opts: { title: string; description?: string; confirmLabel?: string; variant?: "default" | "destructive" }) {
    return new Promise<boolean>((resolve) => {
      setState({ open: true, ...opts, resolve });
    });
  }

  function handle(result: boolean) {
    state.resolve?.(result);
    setState((s) => ({ ...s, open: false }));
  }

  const dialog = (
    <Dialog open={state.open} onOpenChange={(open) => !open && handle(false)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{state.title}</DialogTitle>
          {state.description && <DialogDescription>{state.description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => handle(false)}>
            Cancel
          </Button>
          <Button variant={state.variant ?? "destructive"} onClick={() => handle(true)}>
            {state.confirmLabel ?? "Confirm"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  return { confirm, dialog };
}
