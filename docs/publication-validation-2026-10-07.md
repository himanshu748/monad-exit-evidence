# Local verification and hosted activation status — October 7, 2026

This dated record separates local HyperIndex checks, the earlier unavailable production state, and the subsequent hosted HyperSync proof. The October 5 application checkpoint was [`15eedc6b9ba93e7e378046ff3d380a170ab099ab`](https://github.com/himanshu748/monad-exit-evidence/commit/15eedc6b9ba93e7e378046ff3d380a170ab099ab); its documentation base was [`54640ae4f7fdc31286dd3bdb4a76115b603836ff`](https://github.com/himanshu748/monad-exit-evidence/commit/54640ae4f7fdc31286dd3bdb4a76115b603836ff). Reviewed October 7 source [`e1fc35108e3ec344ed7da570d69f5b538c43a695`](https://github.com/himanshu748/monad-exit-evidence/commit/e1fc35108e3ec344ed7da570d69f5b538c43a695) adds worker lifecycle fixes, HyperSync request/cache guards and a historical-lookup verifier correction. The [October 5 publication/media record](publication-validation-2026-10-05.md) remains historical evidence; no final submission is claimed.

## Production observation

At **05:25 UTC on October 7**, public reads from https://monad-exit-evidence.vercel.app reported `LIVE_READ_ONLY`, with simulation and trading disabled. Production retained the default HyperIndex source at checkpoint `15eedc6`. Perpl market configuration was live and not stale on both networks. Indexed activity was unavailable on both networks: no events and null watermarks. This earlier observation was superseded by the hosted checks below; neither check guarantees later availability.

## Local verification

A separate named `oct07-live` HyperIndex window was created using actual public Monad RPC heads. Its recorded start blocks were mainnet **111240327** and testnet **68887263**. A clean stop released the owned indexer and PostgreSQL processes; restarting the same window preserved its window-file hash and start blocks while committed watermarks advanced. Existing databases and checkpoints were retained. This remains a temporary foreground Mac worker, not durable hosting.

The resumed exports at **05:32:55 UTC** recorded mainnet committed watermark **111241342** and testnet **68888272**, with **50 recent events per network**. These are bounded previews from the recorded window, not complete exchange history.

The final Node 24 verification completed on October 7:

| Check | Result |
| --- | --- |
| Backend tests after audit remediation | 123 passed |
| Web tests | 36 passed |
| Root and Envio typechecks | Passed |
| Full web/API build and web format check | Passed |
| Browser smoke | Real index/chain matches on both networks; exact JSON export and network reset; no browser errors, API write requests or mobile overflow |
| Bounty evidence | Live Perpl and HyperIndex reads on both networks; submission readiness remains false |

The post-audit suite covers final-exit bounds with a retained handle, the installed PostgreSQL dependency's exit-status behavior, stream closure, credential exclusion, shared per-instance HyperSync request limits, original-time cache expiry and historical lookup across provider replicas. HyperSync inputs in these regressions are explicitly offline. The genuine clean-stop/resume observations above precede the final audit remediation; the running worker was retained during verification rather than restarted again. None of these checks establishes authenticated hosted HyperSync operation.

An actual Claude Sonnet 5.5 closure review read the seven changed supervisor/HyperSync/verifier source and test files. The reviewer used no tools and ran no tests or authenticated provider queries; the 123-backend/36-web and browser results above were executed separately by the implementation agent. That bounded source review does not certify hosted integration, the full repository or organizer eligibility.

An additional independent receipt check at **05:30 UTC** matched contract, block hash, complete ABI-decoded values and chain provenance for these real indexed events:

| Network | Transaction | Log index |
| --- | --- | --- |
| Mainnet | `0xc10ccaf584825867e9bf3b9428e8c24d02ea7a59c5401d0643cc3a38c9cd234c` | 52 |
| Testnet | `0x1acb2232aa4db27ef400937c88603aa902b7ab82eeca07d7c1ae5cc206b618fe` | 132 |

At **05:52 UTC**, the fresh post-remediation browser run loaded the candidate application and exercised its independent canonical-block/receipt comparison, returning `INDEX_AND_CHAIN_MATCH` on both networks against the retained genuine local worker. These are point-in-time provider observations, not finality, viewer ownership or app-executed trading proof. Unit and DOM tests also contain explicitly offline regressions; those inputs are not served as application data.

## Hosted path and remaining actions

The selected hosted path is the existing [on-demand HyperSync integration](mac-independent-hypersync.md), intended to remove the Mac worker, PostgreSQL host and tunnel from the application data path using free hosted reads. The operator obtained explicit approval for one replacement token in the existing free package. No token value is included in source or evidence.

At **05:58:31 UTC**, actual authenticated reader results returned `live`, `HYPERSYNC` and the capped preview of **50 events per network**: mainnet watermark **111246418**, testnet **68893363**, from the expected official origins. The preview covers 16 blocks and returns up to 50 events, not complete history. Original read-start timestamps were **05:58:25 UTC** and **05:58:29 UTC**, respectively. This resolved the initial authenticated access/parser gate for those responses. Deployment and local-service-off checks were still pending at that point; subsequent observations below resolve those dated gates.

### Hosted checks with local services stopped

The release operator records deployment of checkpoint `e1fc351` to https://monad-exit-evidence.vercel.app with HyperSync selected. Initial public health/activity checks reported read-only operation and live HyperSync activity on both networks. A separate client-side baseline completed at **06:02:10 UTC**, matching actual hosted events against direct public Monad RPC chain, receipt, canonical-block and complete ABI-decoded values.

The first absence observation was **06:03:33 UTC**; a saved formal repeat check was recorded at **06:04:14.784 UTC**. The operator identified the owned supervisor (PID 10997), its PostgreSQL/indexer children (10998/11005), and the local application (11539) by command, parentage and the application's checkout working directory before stopping them. Execution-tool session handles 57608/91849 were not OS process IDs. The recorded commands were:

```sh
ps -p 10997,10998,11005,11539 -o pid,ppid,command
lsof -a -p 11539 -d cwd
lsof -nP -iTCP:4100 -iTCP:5439 -iTCP:9899 -sTCP:LISTEN
pgrep -fl cloudflared
kill -TERM 10997 11539
```

The saved inventory is explicitly transcribed from actual pre-stop tool results. Repeat `ps` returned only its header; `lsof` returned exit 1 with empty stdout/stderr for the three ports, meaning no matching listeners. No Cloudflare tunnel process was found. Databases and checkpoints were preserved. The cache-expiry wait was measured from the initial absence observation. The independent client check completed again at **06:04:23 UTC**, with both read-starts also later than the saved formal repeat check:

| Network | Hosted read-start time (UTC) | Watermark | Direct client RPC comparison |
| --- | --- | --- | --- |
| Mainnet | 06:04:16 | 111247575 | Chain ID, successful receipt, canonical block and complete normalized values matched |
| Testnet | 06:04:21 | 68894523 | Chain ID, successful receipt, canonical block and complete normalized values matched |

Both source reads began after the recorded shutdown. A further read-only process/port check confirmed those owned processes remained absent. The client obtained receipt/block data itself; it did not rely on the application's observation endpoint or a digest as proof of that comparison. It reused the published ABI/normalizer, so this is independent source acquisition rather than an independently implemented decoder. Deployment source labels remain server-attested and are bound separately to the operator's deployment/configuration record.

These results demonstrate the tested hosted read path functioning without the Mac services at that time. They do not guarantee sustained uptime, finality, token-wide quota headroom or organizer eligibility.

### Historical attempts, recovery and bounded review

Two earlier full paired verifier runs failed at their second, testnet target comparison. At **06:05:45 UTC**, a public diagnostic returned `CHAIN_OBSERVED` with Envio `UNAVAILABLE`. At **06:06:36 UTC**, a direct authenticated query for that same historical block returned live, one matching event and three HTTP 200 responses. At **06:06:53 UTC**, the old target's public observation returned `INDEX_AND_CHAIN_MATCH`. Those isolated recoveries did not include the full verifier's preview-advancement check and were not presented as full paired passes. A shared-guard explanation is a hypothesis; no correlated function diagnostic established the exact cause.

The external runner then reused the existing strict discovery, actual preview advancement, exact historical coverage, unchanged event fields, freshness and digest checks without modification. It inserted a real **60-second gap** between networks and completed both successfully at **06:10:50 UTC**. This is sequential historical verification, not simultaneous freshness or a general availability guarantee.

The operator's dashboard showed the Free 15-rpm package with an automatic initial 30-minute boost. Historical query headers reported cost zero during that boost; no purchase or plan change was made. Normal post-boost costs and token-wide free-budget availability remain unverified. Public traffic shares the token budget, while the application guards/caches are per serverless instance. The bounded JSON client fits the existing read-only serverless function without a persistent indexer; provider limits can still produce unavailable reads.

An actual Claude Sonnet 5.5 hosted-evidence review read the supplied reader/verifier, then-current dated record and evidence excerpts. It ran no tools, tests or provider queries and found no reader code blocker for the bounded point-in-time publication claim. That review began before the successful spaced packet and final bridge-setting-free redeployment; it does not extend review coverage to those later observations. Before the verifier's console wording was corrected, all seven source/test hashes in the final verification record matched deployed checkpoint `e1fc351`. The correction changes only the operator message to identify server-reported labels and server-side RPC comparison; it does not change the API or proof checks.

### Final configuration and remote browser

Final deployment: https://monad-exit-evidence-2s6j8vzcu-himanshus-projects-acd54afd.vercel.app, aliased to https://monad-exit-evidence.vercel.app. Public reads use `/api/health`, `/api/activity?network=mainnet` and `/api/activity?network=testnet`. The fixed upstream origins are https://monad.hypersync.xyz and https://monad-testnet.hypersync.xyz; receipt comparisons use the corresponding public Monad RPC endpoints. The sensitive Production credential is named `ENVIO_API_TOKEN`; no credential or database is published.

The operator removed the obsolete `ENVIO_SNAPSHOT_ORIGIN` setting and redeployed the unchanged application checkpoint `e1fc351`. The automated browser run against the production alias completed at **06:13:39 UTC**: genuine HyperSync/chain matches on both networks, exact observation export, network reset, no browser errors or API write requests, and no mobile horizontal overflow. This was a remote run; no local server or indexer was restarted.

After the browser's 30-second cache boundary, a final independent client RPC comparison completed at **06:16:03 UTC**. Fresh source reads began at **06:16:00 UTC** on mainnet (watermark **111249907**) and **06:16:02 UTC** on testnet (watermark **68896844**); chain ID, successful receipt, canonical block and complete normalized values matched on both. These observations concern the final configuration at the dated check and retain the provider-quota, shared-decoder and point-in-time limitations above. Fresh narrated final-build footage and hosted watch links still remain separate requirements.

The release operator records that one portal project draft was created on October 7 and profile/team checks were completed. No final submission or primary-track selection has been made; primary-track eligibility remains unconfirmed. Continue that existing draft instead of creating another entry.

The operator's October 7 signed-in catalog check still permits HyperSync client code with a useful consumer and end-to-end demonstration for the track-agnostic Envio bounty. The current primary-track names are **Onchain Finance & Trading** and **Trust, Identity & AI Infrastructure**; the latter emphasizes a developer infrastructure primitive. Neither name establishes this project's eligibility. Follow the actual logo form's stricter limits: PNG/JPG/WEBP, at most **2 MB**, minimum **500 px**, and at most **4 million pixels**.

The final deployed build passed the dated checks above. Remaining manual deliverables are fresh footage of **that build**, a technical demonstration and pitch with Deepgram narration, review of the actual outputs, and working public or unlisted YouTube, Loom or Vimeo links. Historical October 4 HyperIndex footage does not demonstrate the new deployed mode.

Complete the existing project's `?tab=submission` form, including eligibility, participant declarations and required deliverables, before **October 13, 2026 at 23:59 ET / October 14 at 09:29 IST**. The release operator freshly verified that deadline in the signed-in dashboard on October 7; it also matches the [saved October 4 rules](hackathon-rules-2026-10-04.md). Recheck the portal deadline before submitting. Data readiness and a saved draft do not establish organizer eligibility or submission completion.
