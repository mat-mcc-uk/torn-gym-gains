# Tutorial & FAQ

How to use the Gym Gains Predictor and where its limits are.

## What it is

The script sits on your gym page and predicts gym gains from your live data. It reads your stats, happy, energy, and perks from the Torn API, then tells you what a full energy bar earns in any gym and which gym is best for each stat right now.

## First run

1. Install a userscript manager (Tampermonkey on desktop, the built-in manager on PDA).
2. Install the script from the raw GitHub link.
3. Open the gym page. The panel appears top right on desktop, docked near the bottom on mobile.
4. Open settings (the gear icon) and paste your API key.
5. It pulls your data and fills the tables.

## The API key

Make a custom key in Torn under Preferences, API Key, scoped to:

- `user`: battlestats, bars, perks, gym

Never use someone else's key and never share yours. The key stays in your userscript manager's storage and only ever goes to api.torn.com.

## Reading the tables

**Your gym** shows, for each stat, the gain from a single train at your current happy, and the gain from a full bar of energy with happy decaying as you train.

**Best gym per stat** runs the same full-bar sim across every gym and names the best one for each stat. If your selected gym is already the best for a stat, it's highlighted.

The live line shows your happy, energy, and how much energy the prediction is simulating. Change the energy field to model a different amount, like a single refill or a happy jump bar.

## The what-if calculator

Tick the what-if calculator to override the live values and model a scenario. Three fields: energy, happy, and total perk percentage. Type into any of them and both tables update.

A blank field uses your live value. So you can type 99999 into happy and leave the rest blank to see what a full happy jump gains you at your real stats and perks. Type 30 into perk percentage to see what reaching plus 30 percent gym gains would do. The readout shows a calc mode tag while the calculator is on.

The perk field is a single percentage applied to all four stats. Your live perks can differ per stat, but for a scenario a single number is easier to reason about. Untick the box to go back to live numbers. Typed values are saved between sessions.

## How the prediction works

It uses the Vladar/Darkkk formula:

```
gain = (dots*4) * (0.00019106*stat + 0.00226263*happy + 0.55) * (1+perks) / 150 * energyPerTrain
```

For a full bar it runs train by train, dropping happy by about half the energy per train each time, because your gains fall as happy drops. It adds each train's gain to your stat total as it goes, so the stat-growth feedback is modelled too.

It does not include the formula's random term, which can't be predicted. So the per-train number is the expected value, and any real train scatters around it.

---

# FAQ

**Why are my predictions lower than what I actually gain?**

If a stat is over 50m, that's expected. Torn removed the hard stat cap and added a post-50m growth curve they never published, so the script clamps the stat at 50m and under-reads above it. The panel warns you when this applies. Below 50m, predictions should match within the game's randomness.

**Why is a single train different each time I train?**

The formula has a random component, a few hundred up to about 1500 depending on the stat. It can't be predicted, so the script shows the average. Over a full bar the randomness averages out and the total is close.

**Does it train for me?**

No. It only predicts. You click train yourself.

**Why does it show gyms I haven't unlocked?**

The best-gym comparison shows what each gym would give, including specialist and higher gyms you may not have access to yet. It doesn't enforce unlock requirements. Treat locked gyms as a target, not an option you have right now.

**My perks don't look like they're counted.**

The script parses perk text from the API. Most perks follow a standard format and parse fine, but an unusual wording could be missed. If your gains look off and you have stat-specific gym perks, that's the first thing to check. Tell me the exact perk text and I'll add the case.

**How do I model a different happy or energy without spending it?**

Tick the what-if calculator and type the values you want into the energy, happy, or perk fields. The tables recompute without touching your account. A blank field uses your live value, so you can change one thing and hold the rest. Untick the box to return to live numbers.

**Does the calculator change my real stats?**

No. It only changes the numbers the prediction uses. Your account is untouched. The readout shows a calc mode tag so you can tell modelled numbers from live ones.

**Does happy decay matter?**

Yes, a lot for a full bar. Each train lowers your happy, which lowers the next train's gain. The full-bar number accounts for this. The per-train number assumes your current happy, so it's the gain for the next single train only.

**Can the faction share one key?**

No. Each person uses their own key. The script reads your personal stats, happy, and perks.

**How do I get updates?**

The script carries update headers pointing at the repo. Tampermonkey and PDA pull new versions automatically. Force a check from Tampermonkey's Utilities tab.

**It's cramped or hidden on PDA.**

The panel docks above PDA's bottom tab bar and collapses its settings behind the gear on narrow screens. If it sits too low or high, the clearance value in the mobile CSS is the number to nudge.

## What it does not do

- It does not train for you.
- It does not predict the random part of a single train.
- It does not model gains above 50m accurately, because Torn hasn't published that maths.
- It does not enforce gym unlock requirements in the comparison.
- It does not account for temporary boosts the API doesn't report.
