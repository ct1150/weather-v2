# OPC product funnel analytics

Dataset: `wnr_product_events_v1`

The product-analytics Worker accepts one allowlisted event per request, validates it with
`@wnr/analytics`, rejects sensitive fields and writes a fixed Analytics Engine row. No raw URL,
query string, free text, account, email, user ID, session ID, device ID, IP address or itinerary
content is stored.

## Fixed schema

| Column | Meaning |
|---|---|
| `index1` | event name / sampling index |
| `blob1` | locale |
| `blob2` | route template |
| `blob3` | origin ID |
| `blob4` | transport mode |
| `blob5` | days-until-departure bucket |
| `blob6` | no-result reason |
| `blob7` | destination or city ID |
| `blob8` | result type |
| `blob9` | creation source |
| `blob10` | affiliate category |
| `blob11` | placement |
| `blob12` | provider or network ID |
| `blob13` | destination key or country code |
| `blob14` | ranking window |
| `blob15` | ranking theme |
| `double1` | maximum one-way planning minutes |
| `double2` | trip length days |
| `double3` | reachable destination count |
| `double4` | returned result count |
| `double5` | result position or rank |
| `double6` | shortlist count |
| `double7` | calendar reminder count |
| `double8` | rain limit set (`1`/`0`, `-1` N/A) |
| `double9` | wind limit set (`1`/`0`, `-1` N/A) |
| `double10` | temperature limit set (`1`/`0`, `-1` N/A) |
| `double11` | generic bounded count |
| `double12` | fallback flag (`1`/`0`, `-1` N/A) |

Use `SUM(_sample_interval)` for event counts. The SQL files in this directory are deliberately
small and can be submitted to the Cloudflare Analytics Engine SQL API without a dashboard.
