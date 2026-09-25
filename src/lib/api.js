import { rememberRun, forgetRun, tokenFor } from "./storage.js";

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function request(path, { method = "GET", body, headers = {}, runId } = {}) {
  const h = { ...headers };
  const token = runId ? tokenFor(runId) : null;
  if (token) h["x-owner-token"] = token;
  if (body && !(body instanceof FormData)) h["content-type"] = "application/json";
  let res;
  try {
    res = await fetch(path, { method, headers: h, body: body && !(body instanceof FormData) ? JSON.stringify(body) : body });
  } catch {
    throw new ApiError("Can't reach the server. Check your connection and try again.", 0);
  }
  if (res.status === 204) return null;
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
  if (!res.ok) throw new ApiError(data?.error || `Request failed (${res.status})`, res.status);
  if (data === null) throw new ApiError("The server sent an unexpected response.", res.status);
  return data;
}

export const api = {
  health: () => request("/api/health"),
  getRun: (id) => request(`/api/runs/${encodeURIComponent(id)}`, { runId: id }),
  listRuns: (ids) => request(`/api/runs?ids=${ids.map(encodeURIComponent).join(",")}`),
  async runSample(k = "auto") {
    const data = await request("/api/runs", { method: "POST", body: { source: "sample", k } });
    rememberRun(data.run.id, data.ownerToken);
    return data;
  },
  recluster: (id, k) => request(`/api/runs/${id}/recluster`, { method: "POST", body: { k }, runId: id }),
  playbook: (id, context) => request(`/api/runs/${id}/playbook`, { method: "POST", body: { context }, runId: id }),
  ask: (id, question) => request(`/api/runs/${id}/ask`, { method: "POST", body: { question }, runId: id }),
  async remove(id) {
    await request(`/api/runs/${id}`, { method: "DELETE", runId: id });
    forgetRun(id);
  },
  exportUrl: (id) => `/api/runs/${encodeURIComponent(id)}/export`,
};

/**
 * Upload a CSV (gzipped in the browser when supported) with progress events.
 * onProgress(fraction) covers the upload; the server work happens after.
 */
export function uploadRun(blob, meta, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append("meta", JSON.stringify(meta));
    form.append("file", blob, meta.gzip ? "upload.csv.gz" : "upload.csv");
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/runs");
    xhr.upload.onprogress = (e) => { if (e.lengthComputable) onProgress?.(e.loaded / e.total); };
    xhr.upload.onload = () => onProgress?.(1);
    xhr.onerror = () => reject(new ApiError("Upload failed. Check your connection and try again.", 0));
    xhr.onload = () => {
      let data = null;
      try { data = JSON.parse(xhr.responseText); } catch { /* not JSON */ }
      if (xhr.status >= 200 && xhr.status < 300 && data?.run) {
        rememberRun(data.run.id, data.ownerToken);
        resolve(data);
      } else {
        reject(new ApiError(data?.error || (xhr.status === 413 ? "That file is too large for one upload." : `Upload failed (${xhr.status}).`), xhr.status));
      }
    };
    xhr.send(form);
  });
}

export async function gzipBlob(file) {
  if (typeof CompressionStream === "undefined") return { blob: file, gzip: false };
  const stream = file.stream().pipeThrough(new CompressionStream("gzip"));
  const blob = await new Response(stream).blob();
  return { blob, gzip: true };
}
