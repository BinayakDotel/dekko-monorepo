export type ParsedPrUrl = {
  owner: string;
  repo: string;
  prNumber: number;
};

const PR_URL =
  /^https?:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)\/?(?:\?.*)?(?:#.*)?$/i;

export function parsePrUrl(url: string): ParsedPrUrl {
  const match = PR_URL.exec(url.trim());
  if (!match) {
    throw new Error("expected a GitHub pull request url like https://github.com/owner/repo/pull/123");
  }
  const owner = match[1];
  const repo = match[2];
  const prNumberRaw = match[3];
  if (!owner || !repo || !prNumberRaw) {
    throw new Error("expected a GitHub pull request url like https://github.com/owner/repo/pull/123");
  }
  return { owner, repo, prNumber: Number(prNumberRaw) };
}
