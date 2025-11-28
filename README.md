# Bingo 100 Prototype

This is a simple, responsive web prototype of the Bingo 100 game.

## Game rules covered
- Numbers 1–100 are called without repetition.
- Each ticket has 2 rows × 9 columns with exactly 10 numbers (unique within the ticket).
- Full House: first ticket to mark all 10 numbers wins (30% RTP noted).
- Total Score: each ticket has a progress bar that sums the values of marked numbers. If the total exceeds 100, it wraps back to 0. When the bar reaches ≥75, it turns green.
- After a Full House, the calls stop and the Total Score prize is awarded to the ticket with score 100 or, if none, the one closest (highest score).
- RTP totals shown as informational labels (85% total, split 30%/55%).

## Run locally
Open `index.html` in your browser (no build steps).

## Controls
- Set the number of tickets (1–20).
- Start Game
- Call Next Number
- Reset

## Notes
- The ticket grid positions numbers by column ranges (1–10, 11–20, …, 91–100). Distribution across rows is simplified for the prototype.
- Uniqueness is enforced per ticket. If global uniqueness across all tickets is required, ticket generation can be adjusted to draw from a shared pool.
