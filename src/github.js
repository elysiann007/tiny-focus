export function repositoryName(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9_.-]{1,100}$/.test(value)) {
    throw new Error('Use a public repository in owner/repo format.');
  }
  const [owner, repo] = value.split('/');
  if (repo === '.' || repo === '..') throw new Error('Invalid repository name.');
  return { owner, repo };
}

export async function openTasks(repository, fetcher = fetch) {
  const { owner, repo } = repositoryName(repository);
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/issues?state=open&per_page=100`;
  let response;
  try {
    response = await fetcher(endpoint, {
      headers: { Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'tiny-focus' },
      signal: AbortSignal.timeout(10_000),
      redirect: 'error'
    });
  } catch { throw new Error('Could not reach GitHub within 10 seconds. Check your connection and try again.'); }
  if (response.status === 404) throw new Error('Public repository not found. Private repositories are not supported.');
  if (response.status === 403 || response.status === 429) throw new Error('GitHub blocked or rate-limited this request. Please try again later.');
  if (!response.ok) throw new Error(`GitHub request failed (HTTP ${response.status}).`);
  let data;
  try { data = await response.json(); }
  catch { throw new Error('GitHub returned an unreadable response.'); }
  if (!Array.isArray(data)) throw new Error('GitHub returned an unexpected response.');
  return data.filter(item => !item.pull_request).slice(0, 10).map(item => {
    if (!Number.isSafeInteger(item.number) || item.number < 1 || typeof item.title !== 'string') {
      throw new Error('GitHub returned an invalid issue.');
    }
    return {
      number: item.number,
      // Untrusted issue titles must not inject control sequences into the terminal.
      title: item.title.replace(/[\x00-\x1f\x7f-\x9f\u202a-\u202e\u2066-\u2069]/g, ' '),
      url: `https://github.com/${owner}/${repo}/issues/${item.number}`
    };
  });
}
