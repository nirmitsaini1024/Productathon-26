# eProcure Scraper

A Node.js scraper for extracting tender information from the Indian government's eProcure portal (eprocure.gov.in).

## Features

- 🔍 **Keyword-based tender search** - Search for tenders using multiple keywords
- 📊 **Detail page scraping** - Automatically scrapes additional details from each tender's detail page including:
  - Estimated value/cost
  - EMD (Earnest Money Deposit) amount
  - Tender fee
  - Work description
  - Location
  - Pre-bid date
  - Category information
- 📁 **Smart file handling** - Only saves JSON files with actual data (no empty files)
- 🔄 **Incremental updates** - Merges new results with existing data (deduplicates by reference + URL)
- 🎯 **Organized output** - Saves both per-keyword results and combined results
- 🤝 **Government-friendly** - Serial scraping with polite delays to avoid overloading the server
- 🔁 **Retry logic** - Handles network errors and rate limiting gracefully
- 🍪 **Session management** - Maintains cookies across requests for proper form submissions

## Prerequisites

- Node.js 20 or higher (required for modern dependencies)
- npm or yarn

## Installation

```bash
npm install
```

## Usage

### Basic Usage

Run with default keywords from `src/keywords.js`:

```bash
npm start
```

### Custom Keywords via CLI

Specify keywords as command-line arguments:

```bash
node src/index.js "diesel" "fuel oil" "bitumen"
```

### Custom Keywords via Environment Variable

```bash
KEYWORDS="diesel,cement,steel" node src/index.js
```

### Skip Detail Scraping

If you want to scrape only the list pages without fetching detail pages:

```bash
SKIP_DETAILS=1 node src/index.js
```

### Download Documents

Download all PDF documents (NIT documents, tender documents, BOQ files):

```bash
DOWNLOAD_DOCS=1 node src/index.js "Bitumen"
```

Documents will be saved to `output/documents/` with their original names.

### Reset Mode

Clear existing results and start fresh:

```bash
RESET=1 node src/index.js
```

### Custom Delay Between Keywords

Adjust the delay between keyword searches (default: 3000ms):

```bash
DELAY_MS=5000 node src/index.js
```

### Combined Options

```bash
RESET=1 DELAY_MS=4000 DOWNLOAD_DOCS=1 KEYWORDS="diesel,bitumen" node src/index.js
```

## Output Structure

```
output/
├── tenders.json              # Combined results from all keywords (deduplicated)
├── by-keyword/
│   ├── diesel.json           # Results for "diesel" keyword
│   ├── bitumen.json          # Results for "bitumen" keyword
│   └── ...                   # One file per keyword (only created if data exists)
└── documents/                # Downloaded PDF documents (if DOWNLOAD_DOCS=1)
    ├── Tendernotice_1.pdf
    ├── tenderdoc.pdf
    ├── BOQ_940297.xls
    └── ...
```

### Sample Output Entry

```json
{
  "keyword": "Diesel",
  "publishedDate": "04-Feb-2026 06:55 PM",
  "closingDate": "26-Feb-2026 03:00 PM",
  "openingDate": "27-Feb-2026 03:30 PM",
  "title": "Supply of HSD Diesel for DG Sets",
  "reference": "[TENDER/2026/123][2026_ORG_123456_1]",
  "organisation": "Example Organisation Name",
  "detailUrl": "https://eprocure.gov.in/eprocure/app?...",
  "estimatedValue": "Rs. 50,00,000",
  "emdAmount": "Rs. 1,00,000",
  "tenderFee": "Rs. 5,000",
  "description": "Supply of High Speed Diesel for DG sets...",
  "location": "Delhi",
  "preBidDate": "15-Feb-2026 11:00 AM",
  "paymentInstruments": ["R-T-G-S", "NEFT"],
  "covers": [
    {
      "coverNo": "1",
      "coverType": "Fee/PreQual/Technical",
      "description": "signed and scanned copy of tender fee and EMD",
      "documentType": ".pdf"
    }
  ],
  "nitDocuments": [
    {
      "name": "Tendernotice_1.pdf",
      "description": "nit",
      "sizeKB": "300.99",
      "downloadUrl": "https://...",
      "localPath": "documents/Tendernotice_1.pdf"
    }
  ],
  "workItemDocuments": [
    {
      "type": "Tender Documents",
      "name": "tenderdoc.pdf",
      "description": "tender document",
      "sizeKB": "3634.72",
      "downloadUrl": "https://...",
      "localPath": "documents/tenderdoc.pdf"
    }
  ]
}
```

## Configuration

### Keywords

Edit `src/keywords.js` to customize the default keyword list. The file includes:
- Core fuels (HSD, Diesel, LDO, Furnace Oil, etc.)
- Marine/bunker fuels (MDO, MGO, VLSFO)
- Bitumen grades (VG-10, VG-20, VG-30, etc.)
- Solvents and specialties
- Industrial usage terms (DG Set, Boiler, Generator, etc.)

### Concurrency

The scraper uses:
- **1 concurrent keyword search** (serial) - to be respectful to government servers
- **2 concurrent detail page scrapes** - for faster data enrichment

You can adjust these in `src/index.js`:
```javascript
const limit = pLimit(1);        // keyword searches
const detailLimit = pLimit(2);  // detail page scrapes
```

## How It Works

1. **Initialize**: Loads existing results (unless `RESET=1`)
2. **Search**: For each keyword:
   - Attempts Advanced Search (preferred, more filtering options)
   - Falls back to Home Search if captcha is encountered
   - Extracts tender list from results table
3. **Enrich**: For each tender found (if detail scraping enabled):
   - Fetches the detail page **using the same HTTP session** (critical for session-based URLs)
   - Extracts additional information (value, EMD, description, dates, etc.)
   - Merges detail data with list data
4. **Save**: 
   - Deduplicates by reference + detail URL
   - Saves per-keyword files (only if data exists)
   - Saves combined results file (only if data exists)

### Why Session Management Matters

The detail URLs contain session tokens that expire. The scraper maintains the same HTTP session (cookies) from the search through to the detail page fetches, ensuring the session remains valid. This is why detail scraping happens within the same search flow rather than as a separate step.

## Error Handling

- **Network errors**: Automatic retry with exponential backoff
- **Rate limiting**: Handles 429/5xx responses with retries
- **Captcha**: Falls back to alternative search method
- **Failed details**: Logs error but continues with other tenders
- **Session management**: Maintains cookies across requests

## Environment Variables Summary

| Variable | Default | Description |
|----------|---------|-------------|
| `KEYWORDS` | - | Comma-separated list of keywords to search |
| `DELAY_MS` | 3000 | Delay in milliseconds between keyword searches |
| `RESET` | 0 | Set to `1` to clear existing results and start fresh |
| `SKIP_DETAILS` | 0 | Set to `1` to skip detail page scraping |
| `DOWNLOAD_DOCS` | 0 | Set to `1` to download all PDF/Excel documents |
| `MONGO_URI` | - | MongoDB connection string. If set, scraped tenders are upserted into MongoDB |
| `MONGO_DB` | (from URI) | Override database name (optional) |
| `MONGO_COLLECTION` | `tenders` | Base collection name |
| `MONGO_MODE` | `single` | `single` stores all tenders in one collection with a `keywords[]` array. `per_keyword` stores each keyword into a separate collection |
| `MONGO_RESET` | 0 | If `1` and `RESET=1`, clears the target collection(s) before scraping |
| `MONGO_STRICT` | 1 | If `0`, Mongo write errors are logged but won’t fail the run |
| `MONGO_INSERT_ONLY` | 0 | If `1`, only inserts new tenders (never updates existing records) |

### MongoDB Storage (recommended)

This project loads environment variables from a local `.env` file (via `dotenv`). Create it by copying `env.example` to `.env` in the `eprocure-scraper/` folder.

Default (recommended): **one collection** (e.g. `tenders`) with a **unique key** and a `keywords` array, so the same tender matched by multiple keywords is stored once:

```bash
MONGO_URI="mongodb://localhost:27017/eprocure" node src/index.js "diesel" "bitumen"
```

If you truly want **one collection per keyword**:

```bash
MONGO_URI="mongodb://localhost:27017/eprocure" MONGO_MODE=per_keyword node src/index.js "diesel" "bitumen"
```

## Backend API Server (for HPCL UI)

The scraper project also includes a small API server that reads from MongoDB and exposes leads for the UI.

### Run the API

```bash
PORT=4000 npm run api
```

### Endpoints

- `GET /health`
- `GET /api/leads?limit=200` → returns `{ leads, dashboard_metrics }`

### CORS

Optionally restrict browser access with:

- `CORS_ORIGINS="http://localhost:3000,https://your-ui-domain"`

## Troubleshooting

### Node.js Version Error

If you see:
```
ReferenceError: File is not defined
```

You need Node.js 20 or higher. Three options:

**Option 1: Quick test with npx (no installation needed)**
```bash
npx -y node@20 src/index.js "Diesel"
```

**Option 2: Install nvm and Node.js 20**
```bash
# Install nvm (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc

# Install and use Node.js 20
nvm install 20
nvm use 20
```

**Option 3: Update system Node.js**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Empty Results

- The search term might not match any active tenders
- The government portal might be experiencing issues
- Try increasing `DELAY_MS` if getting rate limited

### Captcha Errors

The scraper automatically falls back to home search when captcha is encountered. If issues persist:
- Increase delays between requests
- The portal might be experiencing high traffic

## License

ISC

## Contributing

Feel free to submit issues or pull requests for improvements!
