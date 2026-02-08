# eProcure Scraper - Complete Feature List

## ✅ Core Features

### 1. **Keyword-Based Search**
- Search tenders by multiple keywords
- Supports custom keywords via CLI or environment variable
- Includes 50+ predefined fuel and industrial keywords

### 2. **Detail Page Scraping**
- Automatically scrapes each tender's detail page
- Maintains HTTP session for secure access
- Extracts 50+ detailed fields per tender

### 3. **Document Downloads**
- Downloads all PDF/Excel documents
- Maintains original filenames
- Saves to `output/documents/` directory
- Includes:
  - NIT (Notice Inviting Tender) documents
  - Tender documents
  - BOQ (Bill of Quantities) spreadsheets
  - Technical documents

### 4. **Smart Data Management**
- Automatic deduplication by reference + URL
- Incremental updates (merges with existing data)
- Only saves files with actual data (no empty files)
- Per-keyword and combined outputs

## 📊 Extracted Data Fields

### Basic Information (from list page)
- `keyword` - Search keyword used
- `publishedDate` - Publication date
- `closingDate` - Bid closing date
- `openingDate` - Bid opening date
- `title` - Tender title
- `reference` - Tender reference number
- `organisation` - Organization name
- `detailUrl` - Link to detail page

### Enhanced Details (from detail page)

#### Identification
- `tenderReferenceNumber` - Official reference
- `tenderId` - System-generated ID
- `organisationChain` - Complete organization hierarchy

#### Tender Type & Classification
- `tenderType` - Open/Limited Tender
- `formOfContract` - Works/Goods/Services/Percentage
- `tenderCategory` - Category classification
- `productCategory` - Product category (e.g., Civil Works)
- `subCategory` - Subcategory (e.g., Road Work)
- `contractType` - Type of contract
- `withdrawalAllowed` - Can bids be withdrawn
- `numberOfCovers` - Number of bid covers

#### Evaluation & Bidding Rules
- `generalTechnicalEvaluationAllowed` - Is GTE allowed
- `itemWiseTechnicalEvaluationAllowed` - Is item-wise evaluation allowed
- `allowTwoStageBidding` - Two stage bidding permitted
- `shouldAllowNDATender` - NDA tender allowed
- `allowPreferentialBidder` - Preferential bidder allowed

#### Payment & Currency
- `paymentMode` - Online/Offline
- `isMultiCurrencyAllowedForBOQ` - Multi-currency for BOQ
- `isMultiCurrencyAllowedForFee` - Multi-currency for fees

#### Financial Details
- `tenderValue` - Estimated tender value
- `tenderFee` - Fee for tender document
- `feePayableTo` - Fee payable to entity
- `feePayableAt` - Fee payment location
- `tenderFeeExemptionAllowed` - Fee exemption allowed
- `emdAmount` - Earnest Money Deposit amount
- `emdFeeType` - Fixed/Percentage
- `emdPercentage` - EMD percentage (if applicable)
- `emdPayableTo` - EMD payable to entity
- `emdPayableAt` - EMD payment location
- `emdExemptionAllowed` - EMD exemption allowed

#### Work Details
- `workTitle` - Full work title
- `workDescription` - Detailed description
- `ndaPreQualification` - NDA/Pre-qualification requirements
- `independentExternalMonitorRemarks` - External monitor remarks
- `workLocation` - Work location
- `pincode` - Location pincode
- `bidValidityDays` - Bid validity period
- `periodOfWorkDays` - Work completion period

#### Dates & Timeline
- `publishedDateFull` - Full publication timestamp
- `bidOpeningDateFull` - Full bid opening timestamp
- `docDownloadStartDate` - Document download start
- `docDownloadEndDate` - Document download end
- `bidSubmissionStartDate` - Bid submission start
- `bidSubmissionEndDate` - Bid submission end
- `clarificationStartDate` - Clarification period start
- `clarificationEndDate` - Clarification period end
- `preBidMeetingDate` - Pre-bid meeting date
- `preBidMeetingPlace` - Pre-bid meeting location
- `preBidMeetingAddress` - Pre-bid meeting address
- `bidOpeningPlace` - Bid opening location

#### Administrative
- `tenderInvitingAuthorityName` - Authority name
- `tenderInvitingAuthorityAddress` - Authority address

#### Payment & Documents
- `paymentInstruments` - Array of accepted payment methods
  ```json
  ["R-T-G-S", "NEFT", "Demand Draft", "Bank Guarantee"]
  ```

- `covers` - Array of bid cover information
  ```json
  [{
    "coverNo": "1",
    "coverType": "Fee/PreQual/Technical",
    "description": "Technical documents",
    "documentType": ".pdf"
  }]
  ```

- `nitDocuments` - Array of NIT documents
  ```json
  [{
    "name": "Tendernotice_1.pdf",
    "description": "nit",
    "sizeKB": "300.99",
    "downloadUrl": "https://...",
    "localPath": "documents/Tendernotice_1.pdf"
  }]
  ```

- `workItemDocuments` - Array of work item documents
  ```json
  [{
    "type": "Tender Documents",
    "name": "tenderdoc.pdf",
    "description": "tender document",
    "sizeKB": "3634.72",
    "downloadUrl": "https://...",
    "localPath": "documents/tenderdoc.pdf"
  }]
  ```

## 🚀 Usage Examples

### Basic scraping (list data only)
```bash
SKIP_DETAILS=1 npx -y node@20 src/index.js "Diesel"
```

### With detail scraping
```bash
npx -y node@20 src/index.js "Diesel" "Bitumen"
```

### With document downloads
```bash
DOWNLOAD_DOCS=1 npx -y node@20 src/index.js "Bitumen"
```

### Complete scraping with reset
```bash
RESET=1 DOWNLOAD_DOCS=1 npx -y node@20 src/index.js
```

### Custom keywords and delays
```bash
KEYWORDS="diesel,cement,steel" DELAY_MS=5000 npx -y node@20 src/index.js
```

## 📁 Output Structure

```
output/
├── tenders.json              # All tenders combined (deduplicated)
├── by-keyword/
│   ├── bitumen.json          # Bitumen tenders
│   ├── diesel.json           # Diesel tenders
│   └── ...                   # One file per keyword
└── documents/                # Downloaded documents
    ├── Tendernotice_1.pdf
    ├── tenderdoc.pdf
    ├── BOQ_940297.xls
    └── ...
```

## 🔧 Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `KEYWORDS` | (from file) | Comma-separated keywords |
| `DELAY_MS` | 3000 | Delay between keyword searches |
| `RESET` | 0 | Clear existing results (1=yes) |
| `SKIP_DETAILS` | 0 | Skip detail scraping (1=yes) |
| `DOWNLOAD_DOCS` | 0 | Download documents (1=yes) |

## 🛡️ Robustness Features

- **Session Management**: Maintains HTTP session across requests
- **Retry Logic**: Automatic retry for network errors and rate limiting
- **Error Handling**: Graceful handling of failed requests
- **Captcha Fallback**: Automatic fallback to alternative search method
- **Rate Limiting**: Configurable delays to respect server resources
- **Deduplication**: Prevents duplicate entries by reference + URL
- **Incremental Updates**: Merges with existing data

## 📈 Performance

- Serial keyword searches (respectful to government servers)
- Detail pages scraped within same session
- Configurable delays and concurrency
- Efficient deduplication

## 🎯 Use Cases

1. **Tender Monitoring**: Track tenders for specific products/services
2. **Market Analysis**: Analyze tender values, locations, and frequencies
3. **Document Archival**: Download and archive tender documents
4. **Data Integration**: JSON output for easy integration with other systems
5. **Compliance Tracking**: Monitor tender requirements and timelines
