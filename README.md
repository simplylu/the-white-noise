# WhiteDate - data archive & static explorer

This repository contains a local archival dump and a small static client used to explore profile and group data collected from whitedate.net

Summary
- Data was collected from the site (HTML endpoints / forum pages) and exported to JSON files (`profiles.json`, `groups.json`).
- A set of small Python utilities were used to fetch, clean and normalize the data; a static client (under `site/`) renders charts, lists and a dashboard.

Data files
- `profiles.json` - flattened list of user profiles (one JSON array). Used by the dashboard and profile browser.
- `groups.json` - forum groups and topics; some scripts produce or augment these with message lists.

Sanitization & migration
- `fix_csv_fields.py` - converts comma/semicolon/pipe-separated strings in certain fields (e.g. `interests`, `political_orientation`, `pets`, `mindset`) into arrays. Creates a timestamped backup before writing.
- `clean_groups_posts.py` - small cleaner to remove placeholder or malformed posts from group/topic message lists.
- `fetch_topic_posts.py` - helper to fetch or assemble topic message arrays (used to build `groups_with_messages.json`).

Other useful scripts
- `download_profiles.py`, `download_group_images.py` - utilities to download profile/group images and rewrite references (used offline).
- `parse_profiles.py`, `bs4cli.py` - parsing helpers (BeautifulSoup-based) used during data extraction.

Static client
- The `site/` folder contains the static HTML/CSS/JS UI:
  - `index.html` - landing page
  - `profiles.html`, `groups.html`, `topic.html` - list/detail views
  - `dashboard.html`, `dashboard.js` - charts built with Chart.js and the cross-tab matrix UI

How to run locally
1. Serve the `site/` folder (or the repository root) using a simple HTTP server and open the pages in a browser:
	```bash
	python3 -m http.server 8000
	# then open http://localhost:8000/site/index.html
	```

Notes
- The dataset contains unmoderated, potentially sensitive content. Use and analysis should follow ethical and legal considerations.
- The client expects `profiles.json` and `groups.json` to be present in the web root (or one level up); scripts assume local files and create backups when modifying data.

