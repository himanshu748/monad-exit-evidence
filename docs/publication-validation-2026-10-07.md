# Local verification and hosted activation status — October 7, 2026

This dated record distinguishes the verified local HyperIndex path from the production deployment and pending hosted HyperSync activation. The deployed application checkpoint is [`15eedc6b9ba93e7e378046ff3d380a170ab099ab`](https://github.com/himanshu748/monad-exit-evidence/commit/15eedc6b9ba93e7e378046ff3d380a170ab099ab); the documentation base is [`54640ae4f7fdc31286dd3bdb4a76115b603836ff`](https://github.com/himanshu748/monad-exit-evidence/commit/54640ae4f7fdc31286dd3bdb4a76115b603836ff). The local candidate contains worker lifecycle fixes, prepared HyperSync request/cache guards and a historical-lookup verifier correction. Deployed hosted mode remained unchanged at the check below. The [October 5 publication/media record](publication-validation-2026-10-05.md) remains historical evidence; no final submission is claimed.

## Production observation

At **05:25 UTC on October 7**, public reads from https://monad-exit-evidence.vercel.app reported `LIVE_READ_ONLY`, with simulation and trading disabled. Production retained the default HyperIndex source at the application checkpoint above. Perpl market configuration was live and not stale on both networks. Indexed activity was unavailable on both networks: no events and null watermarks. These observations do not guarantee later availability.

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

The selected next path is the existing [on-demand HyperSync integration](mac-independent-hypersync.md), intended to remove the Mac worker, PostgreSQL host and tunnel from the application data path using free hosted reads. Authenticated event queries on both networks, independent receipt checks and operation without those local services remain unverified. Replacement of the unretrievable existing token and sensitive server-side configuration are pending explicit action-time approval. No token value is included in source or evidence.

After approval, verify actual authenticated responses on both networks, deploy the selected mode, and repeat the public proof after stopping the identified local services and cache expiry. If those services are already absent, record that state instead. Preserve checkpoints. Free-provider quotas remain availability constraints; the prepared architecture alone does not establish durable operation.

The release operator records that one portal project draft was created on October 7 and profile/team checks were completed. No final submission or primary-track selection has been made; primary-track eligibility remains unconfirmed. Continue that existing draft instead of creating another entry.

The operator's October 7 signed-in catalog check still permits HyperSync client code with a useful consumer and end-to-end demonstration for the track-agnostic Envio bounty. The current primary-track names are **Onchain Finance & Trading** and **Trust, Identity & AI Infrastructure**; the latter emphasizes a developer infrastructure primitive. Neither name establishes this project's eligibility. Follow the actual logo form's stricter limits: PNG/JPG/WEBP, at most **2 MB**, minimum **500 px**, and at most **4 million pixels**.

Once the final deployed build passes hosted verification, record fresh footage of **that build**. Prepare the technical demonstration and pitch with Deepgram narration, review the actual outputs, and supply working public or unlisted YouTube, Loom or Vimeo links. Historical October 4 HyperIndex footage does not demonstrate the new deployed mode.

Complete the existing project's `?tab=submission` form, including eligibility, participant declarations and required deliverables, before **October 13, 2026 at 23:59 ET / October 14 at 09:29 IST**. The release operator freshly verified that deadline in the signed-in dashboard on October 7; it also matches the [saved October 4 rules](hackathon-rules-2026-10-04.md). Recheck the portal deadline before submitting. Data readiness and a saved draft do not establish organizer eligibility or submission completion.
