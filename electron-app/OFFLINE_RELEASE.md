# Axis Ortho native companion

Status on 2026-10-07: **preview, not approved for commercial distribution**. The companion is a separate Electron entry point (`companion-main.cjs`), with private local job storage and no bundled web backend, cloud secrets or system Node requirement. Original imagery and completed local outputs remain on the operator's computer.

## Supported build target

The bundled native ODM 3.6.2 runtime currently targets Apple silicon on macOS 14 or newer. It does not require Docker. Windows and Intel Mac do not yet have validated native processing installers. The build preparer rejects other hosts, and the Windows CI target is disabled to prevent shipping a Mac runtime in a Windows installer. Do not market cross-platform availability until each target passes installation and real processing on a clean machine.

The hardened preview is `0.1.0-preview.5`. Its offline builder pins Electron 44.7.0, a supported stable version verified against the official release listing on 2026-10-07. Older preview packages remain historical artifacts and are not commercial releases. The original wrapper's dependency configuration is separate.

## Build and test

From `electron-app`, run `npm run offline:prepare`, then `npm ci --omit=dev --ignore-scripts --prefix .offline-build/app`, `npm run offline:test`, and `npm run offline:package:mac`. Build output stays in `offline-release`. Run `npm run offline:check` and `npm run offline:manifest` afterward. Credentials for code signing and notarization must be supplied through the build environment; web environment files are not loaded. Preserve job data when installing a newer preview.

The current host has only an Apple Development signing identity. Gatekeeper rejected the existing preview application. A Developer ID Application identity, notarization and stapling, plus clean-machine launch verification against exact installer hashes, are still required. An application with a development signature is not a commercially trusted Mac release.

## Processing and deliverables

Folder selection recursively includes JPEG, PNG and TIFF imagery and excludes hidden/system entries and symbolic links. Current import limits are 2,000 images, 1 GB per image and 20 GB per batch; actual capacity depends on RAM, disk, image resolution and scene complexity. Local processing runs one job at a time to avoid overlapping jobs exhausting resources.

A native job is marked completed only after saving the orthomosaic, DSM, ODM PDF report, reconstruction statistics, delivery quality summary and checksum manifest. GDAL decodes the GeoTIFF raster, verifies CRS and nondegenerate pixel geometry, and checks each band's checksum. The PDF signature is checked. `quality.json` records pixel size in CRS units, CRS, alignment statistics, reprojection error and review flags. `delivery.json` records file names, byte lengths and SHA-256 checksums without source filesystem paths.

**Completion is not client acceptance.** The quality summary always requires review of coverage, gaps, seams, blur and independent checkpoints. The internal 90% reconstruction and 2-pixel reprojection thresholds trigger review; they are not an accuracy standard. No GCP or independent checkpoint interface is implemented in this companion. GPS residuals and pixel size do not establish independent positional accuracy. Fast preview bypasses dense reconstruction and must not be represented as a validated surface model. Thermal calibration is camera-dependent; no thermal accuracy certification is supplied by these checks.

Cancellation terminates the ODM process tree and waits for closure before a retry can touch its working directory. Processing checks available disk space before replacing working files and every five seconds while ODM runs, stopping when less than 1 GiB remains. The initial input-size estimate is a guard, not a capacity guarantee: intermediate files can be much larger than input imagery. Failed/interrupted runs preserve copied inputs and a bounded processing log tail. A retry currently recomputes the native job; it does not resume a partially completed ODM stage. Closing the application interrupts processing. Completed files are preserved.

## Mission access and cloud delivery

The owner can approve a device connection through ChatGPT in the browser; field personnel use email/password. Saved sessions use OS credential encryption. Passwords are not saved. Operators must explicitly select an authorized mission. Cloud sync rechecks assignments, isolates saved queues by account, resumes acknowledged upload parts and verifies cloud object size before marking transfer complete. The orthomosaic, DSM, PDF, statistics, quality summary and delivery manifest are uploaded under the same mission. The delivery manifest permits independent file hash verification; cloud size checks alone do not prove content hash integrity.

Mission and company access governs retrieval. SenseHawk receives only authorized mission data. Customized solar health reports remain subject to their separate explicit sharing control; the ODM processing quality PDF is a processing deliverable, not that customized analytical report.

## Distribution gate

The cloud `/api/ortho-releases` endpoint treats every uploaded installer as `preview-unverified`. Only the internal owner can list/download these previews. A higher preview number never enables customer distribution.

After platform verification, a production administrator can set the private deployment variable `AXIS_ORTHO_APPROVED_RELEASES` to a JSON array of `{id,sha256,target,version}`. Each entry must match the exact stored installer and its independently downloaded SHA-256. Targets use `mac-arm64`, `mac-x64`, or `windows-x64`. An absent, invalid or mismatched approval denies customer download, including direct URLs. Do not approve an artifact on the basis of client-supplied upload metadata alone. Record clean-machine installation, signature/notarization, actual processing, cancellation/reopen, export and cloud reconnect evidence for that exact installer hash first.

## Verification evidence and remaining release work

The existing 240-image fast RGB run reconstructed all 240 cameras, produced EPSG:32617 COG imagery with approximately 0.05 m pixels, and passed the new full-raster read/checksum and geometry checks. It has no recorded GCPs and is not an independent accuracy benchmark. Its local data was left intact. The isolated 57-image standard run aligned all cameras (approximately 0.79-pixel reprojection error), but was stopped during texture creation as temporary processing files and simultaneous package builds exhausted available disk space. It did not produce accepted outputs and is not a successful processing validation. Temporary test imagery and intermediates were removed; alignment statistics and logs were retained. A free-space preflight and runtime monitor were added after this failure.

All 74 desktop regression tests passed using the packaged Electron 44.7.0 executable's Node runtime against the source tests. This includes a real child-process runtime storage failure, process closure before retry, preflight preservation of existing files, safe local storage/imports, native execution, process-tree cancellation, invalid geometry, quality flags, upload recovery and account separation. This is not a clean-machine packaged processing run. Package staging and ASAR isolation checks passed; the development app signature passes strict verification but Gatekeeper rejects it. All 36 focused cloud tests and the production build passed. Cloud tests cover unapproved direct downloads, exact artifact approval, pagination, tenant isolation and authorized mission uploads. Test fixtures use isolated local D1/R2 and no customer records.

Cloud safeguards are published at https://axisplatform.app/ortho as Sites version 281 (source `2635dce8f7c3fd43bee555e7107c0f0426f7a475`). Unapproved previews remain owner-only. No release approval variable was configured, and no installer was uploaded or promoted to customer availability during this audit.

Before selling: complete Developer ID/notarization and clean-machine Mac validation; package and verify a Windows native runtime; decide Intel Mac support; validate RGB seam/coverage/accuracy requirements using representative surveys and checkpoints; validate thermal units and temperatures for each supported camera/file format; test actual production owner and field authentication plus outage/reconnection under an isolated test mission; verify license/source distribution obligations for ODM and its bundled dependencies. The runtime includes ODM's license and third-party notices. This document does not claim license compliance has been independently reviewed.

References: [ODM outputs](https://docs.opendronemap.org/outputs/), [fast orthophoto tradeoffs](https://docs.opendronemap.org/arguments/fast-orthophoto/), [ODM license](https://github.com/OpenDroneMap/ODM/blob/master/LICENSE), [Electron support policy](https://www.electronjs.org/docs/latest/tutorial/electron-timelines), [Electron releases](https://releases.electronjs.org/).

## Native platform release work — October 9, 2026

Stanley explicitly rejected Docker. All editions must use native processing. Docker is excluded from the packaged app and engine selection rejects container bundles. Apple-silicon native processing has a real successful local IR validation. Intel and Windows require native SuperBuilds prepared on the matching host; ARM binaries must never be relabeled. Upstream ODM's current manifest does not include osx-64, so Intel requires a separate dependency/build validation before availability can be claimed.

Developer ID Application certificate for team LVKB4SQ2ZC was issued and installed on this Mac. Notarization credentials still require a validated Mac Keychain profile. Builds use APPLE_KEYCHAIN_PROFILE and must pass signature, stapled-ticket and Gatekeeper checks before customer distribution. Windows signing credentials and target-machine validation remain outstanding. No credentials belong in source or logs. Customer approvals remain gated by the exact artifact hash and verification evidence.

Local tests: 78 desktop and three notarization policy checks passed before removing the Docker path; rerun platform checks for the final native-only implementation. No installers were promoted to customer availability. Experimental CI workflow is local; GitHub integration lacks workflow-write access, so Windows/Intel CI has not started.
