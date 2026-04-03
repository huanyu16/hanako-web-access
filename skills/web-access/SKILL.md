---
name: web-access
license: MIT
github: https://github.com/eze-is/web-access
source_note: Adapted for OpenHanako plugin runtime
summary: Chrome CDP-based web access for OpenHanako. Use this skill for search, dynamic pages, login-required sites, and browser interaction.
description: |
  All network tasks that may require real browser state should follow this skill.
  Use Hanako's light web tools for simple discovery and static reading; use hanako-web-access tools for login-required, JS-heavy, or interactive sites.
---

# Hanako Web Access

## What this skill changes

This skill does **not** replace Hanako's existing lightweight web abilities. It adds a stronger browser mode for tasks where static tools are the wrong path.

Use Hanako built-in web search / web fetch for:
- finding official sources
- reading static public pages
- quick factual lookup

Use **hanako-web-access Chrome tools** for:
- pages that require login
- JS-rendered pages
- in-site search on social/content platforms
- clicking, typing, uploading, publishing
- any task where the user's existing Chrome session matters

## Browser philosophy

Think like a capable operator, not a rigid script runner.

1. **Define success first**
   - What exactly counts as done?
   - What information or page state do you need?

2. **Choose the shortest likely-valid path**
   - If the target is known to require login, interaction, or dynamic rendering, go directly to Chrome CDP tools.
   - Do not waste turns repeatedly trying static fetch on blocked platforms.

3. **Treat results as evidence**
   - A failed fetch may mean the method is wrong, not that the content does not exist.
   - A login wall matters only if it truly blocks the target content.
   - If one path clearly stalls, switch tools.

4. **Stop when the target is reached**
   - Do not over-explore once the success condition has been met.

## Tool selection inside Hanako

| Situation | Preferred tool |
|---|---|
| Discover sources or find official pages | Hanako built-in web search |
| Read static public text pages | Hanako built-in web fetch |
| Login-required page | hanako-web-access Chrome tools |
| JS-heavy / dynamic page | hanako-web-access Chrome tools |
| Click, type, upload, publish | hanako-web-access Chrome tools |
| Social/content platform in-site search | hanako-web-access Chrome tools |

## Available Chrome tools

- `hanako-web-access_chrome_open_tab`
- `hanako-web-access_chrome_list_tabs`
- `hanako-web-access_chrome_read_page`
- `hanako-web-access_chrome_eval`
- `hanako-web-access_chrome_click`
- `hanako-web-access_chrome_type`
- `hanako-web-access_chrome_scroll`
- `hanako-web-access_chrome_screenshot`
- `hanako-web-access_chrome_upload_files`
- `hanako-web-access_chrome_close_tab`
- `hanako-web-access_chrome_get_site_pattern`
- `hanako-web-access_chrome_list_site_patterns`

## Safety boundary

- By default, only operate tabs created by this plugin.
- Do not touch the user's existing Chrome tabs unless explicitly required and allowed by configuration.
- Close tabs created for the task after completion.
- Before any high-risk action such as publishing, deletion, payment, or irreversible submission, explicitly confirm intent.

## Site knowledge

The plugin now stores lightweight site knowledge under its private data directory, keyed by domain. After a successful browser read, it writes validated notes such as:
- browser read succeeded on this domain
- an observed page title
- a basic effective pattern that worked

When the target domain is known or likely to recur, check stored knowledge first with:
- `hanako-web-access_chrome_get_site_pattern`
- `hanako-web-access_chrome_list_site_patterns`

Treat stored knowledge as a hint, not a guarantee. Sites change.

## Recommended working pattern

1. If the domain may already be known, inspect stored knowledge first
2. Open a task-specific tab with `chrome_open_tab`
3. Read page structure with `chrome_read_page` or `chrome_eval`
4. Interact with `chrome_click` / `chrome_type` / `chrome_scroll`
5. Use `chrome_screenshot` only when visual state matters
6. Close the owned tab when done

## If Chrome connection fails

Tell the user clearly:
- Open Chrome
- Visit `chrome://inspect/#remote-debugging`
- Enable **Allow remote debugging for this browser instance**
- Accept the Chrome authorization prompt if shown

Then retry.
