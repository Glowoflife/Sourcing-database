"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Plus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format-date";
import type { LeadNote } from "@/db/schema";

interface NotesSectionProps {
  leadId: number;
  notes: LeadNote[];
}

export function NotesSection({ leadId, notes }: NotesSectionProps) {
  const router = useRouter();
  const [newNote, setNewNote] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ content: newNote }),
      });

      if (!response.ok) {
        throw new Error("Failed to add note");
      }

      setNewNote("");
      router.refresh();
    } catch (error) {
      console.error("Error adding note:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="notes" className="space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-zinc-400" />
        <h2 className="text-xl font-semibold text-zinc-900">Sourcing Notes</h2>
      </div>

      <form onSubmit={handleAddNote} className="space-y-3">
        <Textarea
          placeholder="Add a note about this manufacturer (e.g., procurement discussion, pricing, qualifications)..."
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          className="min-h-[100px] bg-white border-zinc-200 focus:ring-blue-500"
          disabled={isSubmitting}
        />
        <div className="flex justify-end">
          <Button 
            type="submit" 
            size="sm" 
            disabled={isSubmitting || !newNote.trim()}
            className="gap-2"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Note
          </Button>
        </div>
      </form>

      <div className="space-y-4 pt-2">
        {notes.length > 0 ? (
          notes.map((note) => (
            <div 
              key={note.id} 
              className="p-4 rounded-lg border border-zinc-100 bg-zinc-50/50 space-y-2"
            >
              <div className="text-sm text-zinc-700 whitespace-pre-wrap leading-relaxed">
                {note.content}
              </div>
              <div className="text-[10px] text-zinc-400 font-medium uppercase tracking-wider">
                {formatDate(note.createdAt)}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-zinc-500 italic py-2 text-center border border-dashed border-zinc-200 rounded-lg">
            No notes yet. Start the conversation by adding one above.
          </p>
        )}
      </div>
    </section>
  );
}
