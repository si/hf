# Repo notes for Claude

## Show notes workflow (House Finesse episodes)

- Episode posts live at `src/posts/<year>/<date>-hf<num>-with-<dj>.md`. Follow the front matter and section conventions of the most recent existing post for the same DJ/format.
- Cover art (`coverImage` front matter, e.g. `HFxxx_with_DJName.jpg`) usually can't be added directly — artwork typically arrives as a pasted image in chat, not a file on disk. When that happens:
  - Push the post/branch and open the PR as normal, referencing the expected image filename in front matter.
  - Give Si a direct link to the GitHub "Upload files" web view for that branch/path, so he can drop the image in himself, e.g.:
    `https://github.com/si/hf/upload/<branch-name>/src/img/cover-images`
