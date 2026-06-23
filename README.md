# Torn Gym Gains Predictor

A userscript for [Torn](https://www.torn.com) that predicts your gym gains from live data. It reads your stats, happy, energy, and perks from the Torn API, then shows what a full energy bar earns in your gym and which gym gives the most for each stat. Runs on desktop browsers through Tampermonkey and on mobile through Torn PDA.

## What it does

- Predicts per-train and full-energy-bar gains for all four stats in your selected gym, simulating happy decay across the bar
- Compares every gym and shows the best one for each stat at your current stats
- Auto-fills your stats, happy, energy, and perks from your API key
- Auto-selects the gym you're currently in
- Parses faction, property, education, book, job, and merit perks into the gain multipliers
- Includes a what-if calculator: override energy, happy, and perk percentage to model a scenario without changing your account

## Install

Install a userscript manager first.

**Desktop:** [Tampermonkey](https://www.tampermonkey.net/) for Chrome, Firefox, Edge, or Safari.

**Torn PDA:** the built-in user scripts manager under Settings.

Then install the script:

1. Open this link: [install the script](https://raw.githubusercontent.com/mat-mcc-uk/torn-gym-gains/main/torn-gym-gains.user.js)
2. Tampermonkey shows an install page. Click **Install**.
3. On PDA, paste the same raw URL into the user scripts manager.

The panel only runs on the gym page (`torn.com/gym.php`). Open the gym and it appears top right, or docked to the bottom on mobile.

## Set up your API key

The script needs your own Torn key. Never use someone else's and never share yours.

Make a custom key under **Preferences, API Key** scoped to what the script reads:

- `user`: battlestats, bars, perks, gym

Paste it into the settings panel (the gear icon) and click Save. The field masks the key behind dots. Click the eye to check it. The key stays in your own userscript manager's storage and only ever goes to api.torn.com.

## Using it

1. Open the gym page. The script pulls your data on load.
2. Pick the gym you want to check, or leave it on the one you're in.
3. Set the energy to spend, or leave it at a full bar.
4. Read the two tables: your selected gym's gains, and the best gym per stat.

The live line shows your current happy and energy and how much energy the prediction is simulating. Hit Refresh from API after you train to pull fresh numbers.

To model a scenario, tick the what-if calculator and fill any of the three fields: energy, happy, or total perk percentage. Both tables recompute as you type, and the readout shows a calc mode tag. Leave a field blank and it uses your live value for that one, so you can change happy alone and keep your real stats and perks. Your typed values persist between sessions. Untick the box to return to live numbers.

## Accuracy and limits

This uses the Vladar/Darkkk gym gain formula, the community standard, reverse-engineered from thousands of data points.

**Below 50m per stat**, predictions are accurate within the game's built-in randomness.

**Above 50m per stat**, predictions under-read. Torn removed the hard stat cap and added a post-50m growth curve they never published. No public tool models it accurately. When any stat is over 50m the panel warns you and you should treat those numbers as a floor.

Two further limits, shared by every Torn gym calculator:

- Each individual train carries a random component (a few hundred to ~1500 depending on stat) that can't be predicted. The per-train figure is the average. A full bar averages it out.
- The gym dot values are hardcoded from the wiki. If Torn changes a gym's dots, the table needs updating.

## Updates

The script carries `@updateURL` and `@downloadURL` headers pointing at this repo. Tampermonkey and Torn PDA pull new versions automatically. To force a check in Tampermonkey, open the dashboard, go to Utilities, and run a userscript update.

## Credits

Gym gain formula by Vladar [1996140] and the Torn community. This script wraps it into a live predictor. Report problems on the [issues page](https://github.com/mat-mcc-uk/torn-gym-gains/issues).

## License

MIT
