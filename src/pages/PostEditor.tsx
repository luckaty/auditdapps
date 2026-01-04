// src/pages/PostEditor.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";
import toast from "react-hot-toast";

const BUCKET = import.meta.env.VITE_SUPABASE_COVERS_BUCKET || "post-covers";

type PostForm = {
  title: string;
  excerpt?: string;
  content?: string;
  cover?: string;
  category?: string;
  tags_input?: string;
  author_name?: string;
  author_avatar?: string;
  read_time?: string;
  published_at?: string; // yyyy-mm-dd
  slug?: string;
};

const empty: PostForm = {
  title: "",
  excerpt: "",
  content: "",
  cover: "",
  category: "",
  tags_input: "",
  author_name: "",
  author_avatar: "",
  read_time: "",
  published_at: "",
  slug: "",
};

// --------- utils ----------
function slugify(t: string): string {
  return t
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}
function toDateInput(v?: string | null): string {
  if (!v) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = new Date(v);
  if (isNaN(d.getTime())) return "";
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    .toISOString()
    .slice(0, 10);
}
function emptyToNull<T extends string | undefined>(v: T): T | null {
  return v && v.trim() !== "" ? v : null;
}
function randId(n = 6) {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < n; i++) s += alphabet[Math.floor(Math.random() * alphabet.length)];
  return s;
}
// ------------------------------------

export default function PostEditor() {
  const { id } = useParams<{ id: string }>(); // optional id for editing
  const navigate = useNavigate();
  const [form, setForm] = useState<PostForm>(empty);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(Boolean(id));
  const [coverUploading, setCoverUploading] = useState(false);
  const isEditing = Boolean(id);

  // Tracks whether the user has manually changed the slug
  const userTouchedSlug = useRef(false);

  // load existing post when editing
  useEffect(() => {
    let active = true;
    (async () => {
      if (!id) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("posts")
        .select("*")
        .eq("id", id)
        .maybeSingle();

      if (error) {
        console.error(error);
        toast.error("Failed to load post");
        setLoading(false);
        return;
      }
      if (!active || !data) {
        setLoading(false);
        return;
      }
      setForm({
        title: data.title ?? "",
        excerpt: data.excerpt ?? "",
        content: data.content ?? "",
        cover: data.cover ?? "",
        category: data.category ?? "",
        tags_input: Array.isArray(data.tags) ? data.tags.join(", ") : "",
        author_name: data.author_name ?? "",
        author_avatar: data.author_avatar ?? "",
        read_time: data.read_time ?? "",
        published_at: toDateInput(data.published_at ?? undefined),
        slug: data.slug ?? "",
      });
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [id]);

  // Auto-suggest slug
  useEffect(() => {
    if (userTouchedSlug.current) return;
    if (!form.title?.trim()) {
      setForm((f) => ({ ...f, slug: "" }));
      return;
    }
    const suggested = slugify(form.title);
    setForm((f) => ({ ...f, slug: suggested }));
  }, [form.title]);

  const parsedTags = useMemo(
    () =>
      (form.tags_input || "")
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    [form.tags_input]
  );

  // ---------- COVER UPLOAD ----------
  async function handleCoverFile(file: File) {
    try {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        toast.error("Please choose an image file");
        return;
      }
      // 5 MB limit
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image must be under 5MB");
        return;
      }

      setCoverUploading(true);

      // who is uploading?
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) {
        toast.error("Please log in first");
        setCoverUploading(false);
        return;
      }
      const uid = userData.user.id;

      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const path = `${uid}/${Date.now()}-${randId()}.${ext}`;

      // upload to Storage
      const { error: upErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });

      if (upErr) {
        console.error("Upload error:", upErr);
        toast.error(upErr.message || "Upload failed");
        setCoverUploading(false);
        return;
      }

      // public URL
      const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const publicUrl = pub.publicUrl;

      setForm((f) => ({ ...f, cover: publicUrl }));
      toast.success("Cover uploaded");
    } finally {
      setCoverUploading(false);
    }
  }
  // ----------------------------------

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);
    const payload = {
      title: form.title,
      excerpt: emptyToNull(form.excerpt),
      content: emptyToNull(form.content),
      cover: emptyToNull(form.cover),
      category: emptyToNull(form.category),
      tags: parsedTags.length ? parsedTags : null,
      author_name: emptyToNull(form.author_name),
      author_avatar: emptyToNull(form.author_avatar),
      read_time: emptyToNull(form.read_time),
      published_at: emptyToNull(form.published_at),
      slug: emptyToNull(form.slug),
    };

    try {
      if (isEditing) {
        if (!id) throw new Error("Missing post id");

        const { error } = await supabase
          .from("posts")
          .update(payload)
          .eq("id", id);

        if (error) throw error;

        toast.success("Post updated");
        navigate(form.slug ? `/blog/${form.slug}` : `/blog/${id}`);


      } else {
        const { data, error } = await supabase
          .from("posts")
          .insert(payload)
          .select("id, slug")
          .single();
        if (error) throw error;
        toast.success("Post published");
        const next = data?.slug ? `/blog/${data.slug}` : `/blog/${data?.id}`;
        navigate(next);
      }
    } catch (err: any) {
      console.error(err);
      const code = err?.code || err?.details || "";
      if (String(code).includes("23505") || /duplicate key/i.test(err?.message || "")) {
        toast.error("Slug already exists. Try another one.");
      } else {
        toast.error("Save failed");
      }
    } finally {
      setSaving(false);
    }
  }

  function bind<K extends keyof PostForm>(key: K) {
    return {
      value: form[key] ?? "",
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [key]: e.target.value })),
    };
  }

  if (loading) {
    return (
      <main className="max-w-3xl mx-auto px-4 py-8">
        <div className="h-6 w-44 bg-slate-200 rounded animate-pulse" />
        <div className="mt-6 h-40 w-full bg-slate-200 rounded-xl animate-pulse" />
      </main>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">{isEditing ? "Edit Post" : "New Post"}</h1>

      <form onSubmit={onSave} className="mt-6 space-y-4">
        <L label="Title" required>
          <input className="inp" required {...bind("title")} />
        </L>

        <div className="grid md:grid-cols-2 gap-4">
          <L label="Category">
            <input className="inp" {...bind("category")} />
          </L>
          <L label="Read time">
            <input className="inp" placeholder="6 min" {...bind("read_time")} />
          </L>
        </div>

        <L label="Excerpt">
          <textarea className="inp" rows={3} {...bind("excerpt")} />
        </L>

        {/* -------- Cover upload section -------- */}
        <div className="grid md:grid-cols-2 gap-4 items-start">
          <L label="Cover photo">
            <input
              type="file"
              accept="image/*"
              className="inp"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleCoverFile(f);
              }}
            />
            <div className="text-xs text-slate-500 mt-1">
              JPG/PNG/WebP, up to 5MB. Upload sets the field automatically.
            </div>
          </L>

          <div>
            <L label="Cover URL (auto-filled)">
              <input className="inp" placeholder="https://…" {...bind("cover")} />
            </L>
            {form.cover ? (
              <img
                src={form.cover}
                alt="Cover preview"
                className="mt-2 rounded-lg border max-h-48 object-cover w-full"
              />
            ) : null}
            {coverUploading && (
              <div className="mt-2 text-sm text-slate-600">Uploading…</div>
            )}
          </div>
        </div>
        {/* ------------------------------------- */}

        <L label="Author name">
          <input className="inp" {...bind("author_name")} />
        </L>

        <L label="Author avatar URL">
          <input className="inp" placeholder="https://…" {...bind("author_avatar")} />
        </L>

        <L label="Tags (comma separated)">
          <input className="inp" placeholder="security, solidity, rls" {...bind("tags_input")} />
        </L>

        <div className="grid md:grid-cols-2 gap-4">
          <L label="Published at (YYYY-MM-DD)">
            <input className="inp" type="date" {...bind("published_at")} />
          </L>
          <L label="Custom slug (optional)">
            <input
              className="inp"
              placeholder="my-first-post"
              {...bind("slug")}
              onChange={(e) => {
                userTouchedSlug.current = true;
                setForm((f) => ({ ...f, slug: e.target.value }));
              }}
            />
            <div className="mt-1 text-xs text-slate-500">
              Preview: <code>/blog/{form.slug || slugify(form.title || "your-title")}</code>
            </div>
          </L>
        </div>

        <L label="Content (Markdown)">
          <textarea className="inp font-mono" rows={14} {...bind("content")} />
        </L>

        {/* Actions */}
        <div className="pt-2 flex gap-2 items-center">
          <button
            type="submit"
            disabled={saving || coverUploading}
            className="rounded-lg bg-blue-600 text-white px-4 py-2 font-semibold disabled:opacity-60"
            title={coverUploading ? "Wait for image to finish uploading" : ""}
          >
            {saving ? "Saving…" : "Save Post"}
          </button>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className="rounded-lg border px-4 py-2 font-semibold hover:bg-slate-50"
          >
            Cancel
          </button>

        
        </div>
      </form>

      <style>{`
        .inp{
          width:100%;
          border:1px solid rgb(203 213 225);
          border-radius:.5rem;
          padding:.5rem .75rem;
          font-size:.95rem;
        }
        label{display:block;font-size:.85rem;color:#334155;margin-bottom:.25rem;font-weight:600}
      `}</style>
    </main>
  );
}

function L({
  label,
  children,
  required,
}: {
  label: string;
  children: React.ReactNode;
  required?: boolean;
}) {
  return (
    <div>
      <label>
        {label}
        {required ? " *" : ""}
      </label>
      {children}
    </div>
  );
}
