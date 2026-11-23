"use client";

import { useAuth } from "@clerk/nextjs";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError, errorMessage, readFailure, uploadImage } from "@/lib/client-api";

export type ClothingItem = {
  id: string;
  name: string;
  type: string;
  color: string;
  description: string;
  image: string;
  createdAt: string;
};

export type OutfitPost = {
  id: string;
  author: string;
  handle: string;
  avatar: string;
  avatarUrl: string | null;
  title: string;
  category: string;
  location: string;
  image: string;
  liked: boolean;
  likes: number;
  owned: boolean;
  items: string[];
  createdAt: string;
};

export type NewItemDraft = {
  name: string;
  type: string;
  color: string;
  description: string;
  imageUrl?: string;
};

export type NewPostDraft = {
  title: string;
  category: string;
  location: string;
};

type FeedStatus = "idle" | "loading" | "ready" | "error";

type AppState = {
  items: ClothingItem[];
  posts: OutfitPost[];
  status: FeedStatus;
  error: string | null;
  refresh: () => Promise<void>;
  addItem: (draft: NewItemDraft, imageFile?: File) => Promise<void>;
  deleteItem: (id: string) => Promise<void>;
  addPost: (draft: NewPostDraft, imageFile: File, itemIds: string[]) => Promise<void>;
  deletePost: (id: string) => Promise<void>;
  toggleLike: (id: string) => Promise<void>;
};

type ItemDto = {
  id: string;
  name: string;
  type: string;
  color: string;
  description: string;
  image_url: string;
  created_at: string;
};

type PostItemDto = { id: string; name: string; type: string };

type PostDto = {
  id: string;
  title: string;
  category: string;
  location: string;
  image_url: string;
  created_at: string;
  likes: number;
  liked: boolean;
  owned: boolean;
  items: PostItemDto[];
  author: { name: string; handle: string; initials: string; avatarUrl: string | null } | null;
};

function toItem(dto: ItemDto): ClothingItem {
  return {
    id: dto.id,
    name: dto.name,
    type: dto.type,
    color: dto.color,
    description: dto.description,
    image: dto.image_url,
    createdAt: dto.created_at,
  };
}

function toPost(dto: PostDto): OutfitPost {
  return {
    id: dto.id,
    author: dto.author?.name ?? "outfiter. member",
    handle: dto.author?.handle ?? "@member",
    avatar: dto.author?.initials ?? "OU",
    avatarUrl: dto.author?.avatarUrl ?? null,
    title: dto.title,
    category: dto.category || "Everyday",
    location: dto.location,
    image: dto.image_url,
    liked: Boolean(dto.liked),
    likes: Number(dto.likes ?? 0),
    owned: Boolean(dto.owned),
    items: (dto.items ?? []).map((item) => item.name),
    createdAt: dto.created_at,
  };
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new ApiError(await readFailure(response));
  return (await response.json()) as T;
}

const AppStateContext = createContext<AppState | null>(null);

export function AppStateProvider({ children }: { children: React.ReactNode }) {
  const { userId } = useAuth();
  // Remounting on identity change resets every piece of cached data, so one
  // account can never see another account's wardrobe or feed.
  return <AppStateStore key={userId ?? "anonymous"}>{children}</AppStateStore>;
}

function AppStateStore({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [posts, setPosts] = useState<OutfitPost[]>([]);
  const [status, setStatus] = useState<FeedStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const postsRef = useRef<OutfitPost[]>([]);

  useEffect(() => {
    postsRef.current = posts;
  }, [posts]);

  const fetchAll = useCallback(
    () =>
      Promise.allSettled([
        fetchJson<{ items: ItemDto[] }>("/api/items"),
        fetchJson<{ posts: PostDto[] }>("/api/feed"),
      ]),
    [],
  );

  const applyResults = useCallback(
    (results: Awaited<ReturnType<typeof fetchAll>>) => {
      const [itemsResult, feedResult] = results;

      if (itemsResult.status === "fulfilled") setItems(itemsResult.value.items.map(toItem));
      if (feedResult.status === "fulfilled") setPosts(feedResult.value.posts.map(toPost));

      const failure =
        itemsResult.status === "rejected"
          ? itemsResult.reason
          : feedResult.status === "rejected"
            ? feedResult.reason
            : null;

      setStatus(failure ? "error" : "ready");
      setError(failure ? errorMessage(failure) : null);
    },
    [],
  );

  const load = useCallback(async () => {
    applyResults(await fetchAll());
  }, [applyResults, fetchAll]);

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetchAll().then((results) => {
      if (!cancelled) applyResults(results);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, fetchAll, applyResults]);

  const addItem = useCallback(async (draft: NewItemDraft, imageFile?: File) => {
    let imageKey = "";
    if (imageFile) {
      imageKey = await uploadImage(imageFile);
    } else if (!draft.imageUrl) {
      throw new ApiError({
        message: "Add a photo of the piece.",
        hint: "Pick a file from your device so the piece shows up in your wardrobe.",
      });
    }

    const response = await fetch("/api/items", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: draft.name,
        type: draft.type,
        color: draft.color,
        description: draft.description,
        ...(imageKey ? { imageKey } : { imageUrl: draft.imageUrl }),
      }),
    });
    if (!response.ok) throw new ApiError(await readFailure(response));

    const data = (await response.json()) as { item: ItemDto };
    setItems((current) => [toItem(data.item), ...current]);
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    const response = await fetch(`/api/items/${id}`, { method: "DELETE" });
    if (!response.ok) throw new ApiError(await readFailure(response));

    setItems((current) => current.filter((item) => item.id !== id));
    // Tagged outfit posts lose the item too; refresh them quietly so the feed
    // never shows a tag that no longer exists.
    try {
      const feed = await fetchJson<{ posts: PostDto[] }>("/api/feed");
      setPosts(feed.posts.map(toPost));
    } catch {
      // The item is already gone; a stale tag is not worth surfacing an error.
    }
  }, []);

  const addPost = useCallback(
    async (draft: NewPostDraft, imageFile: File, itemIds: string[]) => {
      const imageKey = await uploadImage(imageFile);

      const response = await fetch("/api/feed", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, imageKey, itemIds }),
      });
      if (!response.ok) throw new ApiError(await readFailure(response));

      const data = (await response.json()) as { post: PostDto };
      setPosts((current) => [toPost(data.post), ...current]);
    },
    [],
  );

  const deletePost = useCallback(async (id: string) => {
    const response = await fetch(`/api/feed/${id}`, { method: "DELETE" });
    if (!response.ok) throw new ApiError(await readFailure(response));
    setPosts((current) => current.filter((post) => post.id !== id));
  }, []);

  const toggleLike = useCallback(async (id: string) => {
    const previous = postsRef.current.find((post) => post.id === id);
    if (!previous) return;

    // Optimistic: the heart responds immediately, the server result is
    // authoritative and a failure rolls the counter back.
    setPosts((current) =>
      current.map((post) =>
        post.id === id
          ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) }
          : post,
      ),
    );

    try {
      const response = await fetch(`/api/feed/${id}/like`, { method: "POST" });
      if (!response.ok) throw new ApiError(await readFailure(response));

      const data = (await response.json()) as { liked: boolean; likes: number };
      setPosts((current) =>
        current.map((post) =>
          post.id === id ? { ...post, liked: data.liked, likes: data.likes } : post,
        ),
      );
    } catch (likeError) {
      setPosts((current) =>
        current.map((post) =>
          post.id === id ? { ...post, liked: previous.liked, likes: previous.likes } : post,
        ),
      );
      throw likeError;
    }
  }, []);

  const value = useMemo<AppState>(
    () => ({
      items,
      posts,
      status,
      error,
      refresh: load,
      addItem,
      deleteItem,
      addPost,
      deletePost,
      toggleLike,
    }),
    [items, posts, status, error, load, addItem, deleteItem, addPost, deletePost, toggleLike],
  );

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const state = useContext(AppStateContext);
  if (!state) throw new Error("useAppState must be used inside AppStateProvider");
  return state;
}
