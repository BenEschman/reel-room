# Reel Room

Four original **play-money** slot games: no real money, no purchases, and coins have no cash value.

| Game | Mechanic |
|---|---|
| **Wrapped Riches** | Egyptian 5×3, 20 lines. Cash-value coins, a scarab collector on reel 5, and free spins with doubled collects |
| **Sugar Storm** | 6×5 scatter pays (8+ anywhere), tumbles, and multiplier bombs in free spins |
| **Prism Pop** | 10 lines that pay both ways, plus expanding star wilds that lock and respin |
| **Thunder Vault** | Hold & Spin with MINI / MINOR / MAJOR / GRAND jackpots |

## Architecture

- **Frontend:** static HTML/CSS/JS (no build step), served by GitHub Pages
- **Supabase**
  - `profiles`: balance and stats. Clients can read but not write it (RLS)
  - `spins`: spin history (each user can read their own)
  - Edge function `spin`: runs the game math **server-side** (`supabase/functions/spin/engine.js`) and settles the balance atomically through the `settle_spin()` RPC, which only the service role can call. The client only animates the result
  - Edge function `signup`: username + password accounts, no email needed
  - RPC `claim_bonus()`: +5,000 free coins every 4 hours

## Math

```
node sim/sim.mjs 1000000      # RTP / hit rate / feature frequency
node sim/breakdown.mjs 200000 # RTP by feature
```

Simulated over 1M spins: every game lands at roughly 94–96% RTP. Max win is 5,000× the bet.
