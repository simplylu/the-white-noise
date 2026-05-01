![](project_logo.png)

I pulled back the curtain. Behind it is a noisy room filled with the manosphere and its companions: conspiracy theories, fake news, racism, anti‑feminism, extreme conservatism, national socialism,  and the many other troubling "-isms" that gather there. This repository preserves a slice of that world as an archival record - unfiltered, uncurated, and presented so those curious can inspect, analyze, and understand what lies behind the spectacle.

AI was a bit theatralic here, but anyway. If you're ready for it, have a look here: [The White Noise](https://simplylu.github.io/the-white-noise/site/)

Search works fulltext on every piece of information. You can search through profiles with the search or filters, see sent messages, media, group memberships and every detail of the profile that I could find. Same thing for groups. They have no filters, but full text search on groups and the topics within the groups. 

And here is another interesting story about whitedate.net that happened in December last year: [The Heartbreak Machine: Nazis in the Echo Chamber](https://media.ccc.de/v/39c3-the-heartbreak-machine-nazis-in-the-echo-chamber)

And another one, related to the founder of whitedate.net, and how her pseudonym ruined the life of an innocent woman: [ Verfassungsschutz verwechselt Hochschulmitarbeiterin mit Rechtsextremistin ](https://www.spiegel.de/panorama/justiz/berlin-verfassungsschutz-verwechselt-hochschulmitarbeiterin-mit-rechtsextremistin-a-65fb330c-01b6-4baa-9556-ed65ae654dcd)

---

### Technical details

Below you'll find some technical notes about the data, sanitization steps, and the static UI used to explore the archive.


- Data was collected from the site (HTML endpoints / forum pages) and exported to JSON files (`profiles.json`, `groups.json`).
- Small Python utilities were used to fetch, clean and normalize the data; a static client (under `site/`) renders charts, lists and a dashboard for local inspection.

### Data files
- `profiles.json` — flattened list of user profiles (JSON array). Used by the dashboard and profile browser.
- `groups.json` — forum groups and topics; some scripts produce or augment these with message lists.

### Data Collection
Data was collected from an unauthenticated session at whitedate.net. Luckily one has access to everything after account creation, even if the admins haven't marked your profile as legitimate. Thank you! Right after I was done I figured, you don't even need an account to scrape the data, a lot can be accessed without having an account. They didn't learn from Martha Root, right?

I scraped all the profiles, trying to get as much as information as I could. Then I scraped all the groups, as well as the conversations within that group. After around one day and thousands of requests the data is now complete, as of 01.05.2026 13:37 CET.

A lot of sanitization had to be done, and it is still not perfect, but good enough to lurk a bit through the data, look behind the curtain and play around with the dashboard. 

If you want to work with the data on your own, download `profiles.json` and `groups.json`.

Static client
- The `site/` folder contains the static HTML/CSS/JS UI:
	- `index.html` — landing page
	- `profiles.html`, `groups.html`, `topic.html` — list/detail views
	- `dashboard.html`, `dashboard.js` — charts built with Chart.js and the cross-tab matrix UI

How to run locally
1. Serve the `site/` folder (or the repository root) using a simple HTTP server and open the pages in a browser:
	 ```bash
	 python3 -m http.server 8000
	 # then open http://localhost:8000/site/index.html
	 ```

Notes
- The dataset contains unmoderated, potentially sensitive content. Use and analysis should follow ethical and legal considerations.
- The client expects `profiles.json` and `groups.json` to be present in the web root (or one level up); scripts assume local files and create backups when modifying data.

