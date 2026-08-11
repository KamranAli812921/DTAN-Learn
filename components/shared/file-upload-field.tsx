"use client";

import { useRef, useState } from "react";
import { Upload, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { api, fileToDataUri } from "@/lib/client-api";

const MAX_BYTES = 20 * 1024 * 1024;

export function FileUploadField({
  label,
  folder,
  value,
  onChange,
  required,
}: {
  label: string;
  folder: "assignments" | "materials" | "submissions" | "avatars";
  value: string;
  onChange: (url: string) => void;
  required?: boolean;
}) {
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [filename, setFilename] = useState("");

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_BYTES) {
      toast({ variant: "destructive", title: "File exceeds the 20MB limit." });
      return;
    }

    setUploading(true);
    try {
      const dataUri = await fileToDataUri(file);
      const result = await api.post<{ url: string }>("/api/upload", {
        dataUri,
        filename: file.name,
        bytes: file.size,
        folder,
      });
      onChange(result.url);
      setFilename(file.name);
      toast({ title: "File uploaded." });
    } catch (err) {
      toast({ variant: "destructive", title: err instanceof Error ? err.message : "Upload failed." });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={uploading}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          {uploading ? "Uploading…" : "Choose file"}
        </Button>
        {value && (
          <span className="text-sm text-success flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" /> {filename || "Uploaded"}
          </span>
        )}
        <input ref={inputRef} type="file" className="hidden" onChange={handleFile} />
      </div>
      {required && !value && <p className="text-xs text-muted-foreground">A file is required.</p>}
    </div>
  );
}
