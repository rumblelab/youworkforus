# Candy Boss 🎃

A tiny Halloween training game so your kids learn which candy to bring home. Opinionated by design: only two kinds of candy, good and yuck.

1. **The yuck list** (parent, 10 seconds): five nasties are pre-picked (Almond Joy, Mounds, Tootsie Roll, Junior Mints, Butterfinger). Tap any candy to move it between Good and Yuck, or reset to the house rules. Saved in the browser.
2. **Study up** (kid): a CATCH these / DODGE these cheat sheet with candy photos, plus a name and a 30, 45, or 60 second round.
3. **Catch the candy**: slide the pumpkin bucket (finger, mouse, or arrow keys). Each good candy is +1. A yuck candy costs a life; three and the bag is ruined. Candy falls faster and shows up more often as the round goes on.
4. **Results and share**: stars, good candies caught, a breakdown, a share button (phone share sheet, otherwise copies the text), the dodge list, and top scores.

Candy pictures live in `img/<slug>.png`; `img/manifest.json` is the source list (it is also inlined in `index.html`, so the page works from `file://`). If a picture is missing, the game falls back to a drawn wrapper.

## Play it

Open `index.html` in any browser. No build step, no dependencies, works on a phone.
