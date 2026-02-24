---
description: sync frontend files from Downloads (dev) to Projects (production)
---

Run this after making frontend changes to the Downloads codebase to keep the Projects codebase in sync.

// turbo
1. Run the sync script:
```
python3 -c "
import shutil, os, sys

SRC = '/Users/Huvrs/Downloads/skylens-ai---enterprise-drone-inspection (3)'
DST = '/Users/Huvrs/Projects/axis-drone-platform'

# Add files to sync here whenever a new component is added
FILES = [
    'components/WeatherDashboard.tsx',
    'modules/ai-reporting/utils/reportStorage.ts',
    'modules/ai-reporting/components/AIReportArchive.tsx',
    'modules/ai-reporting/components/exportSolarReportPDF.ts',
    'modules/ai-reporting/components/exportReportPDF.ts',
    'modules/ai-reporting/generators/SolarReportGenerator.tsx',
    'modules/ai-reporting/generators/ConstructionReportGenerator.tsx',
    'modules/ai-reporting/generators/TelecomReportGenerator.tsx',
    'modules/ai-reporting/generators/UtilitiesReportGenerator.tsx',
    'modules/ai-reporting/IndustryReportsHub.tsx',
    'modules/ai-reporting/EnterpriseAIReporting.tsx',
    'modules/ai-reporting/config/industryReportSections.ts',
]

for f in FILES:
    s = os.path.join(SRC, f)
    d = os.path.join(DST, f)
    if not os.path.exists(s):
        print(f'SKIP (not found): {f}')
        continue
    os.makedirs(os.path.dirname(d), exist_ok=True)
    shutil.copy2(s, d)
    print(f'OK: {f}')
print('Sync complete.')
"
```

2. Verify the sync by checking a few key file timestamps match between the two folders.

3. If deploying to Cloud Run, run the deploy script:
```
bash /Users/Huvrs/Desktop/deploy-site.command
```
