from .base import BaseScraper
import datetime

class GeMScraper(BaseScraper):
    def __init__(self):
        super().__init__(name="GeMScraper")

    def scrape_listing(self, page=1):
        print(f"[{self.name}] Scraping GeM Marketplace index page {page}")
        self.rate_limit_delay()
        return ["GEM/2026/B/88122", "GEM/2026/B/90100"]

    def scrape_detail(self, tender_id):
        print(f"[{self.name}] Scraping GeM spec list for tender: {tender_id}")
        self.rate_limit_delay()
        
        return {
            "externalId": tender_id,
            "sourcePortal": "GEM",
            "title": "Grid Interfaced SPV Solar Arrays for Bettiah Complex",
            "department": "Bihar Renewable Energy Development Agency (BREDA)",
            "state": "Bihar",
            "category": "Electrical",
            "tenderValue": 1.20,
            "emdAmount": 2.4,
            "publishedDate": datetime.datetime.now().isoformat(),
            "bidSubmissionDeadline": (datetime.datetime.now() + datetime.timedelta(days=14)).isoformat(),
            "workDescription": "Supply and engineering installation of solar systems of 200kW under state subsidiary schemes.",
            "eligibilityCriteria": {
                "minTurnover": 0.8,
                "minExperience": 3,
                "requiredCertifications": ["MSME (Udyam)"],
                "msmeOnly": True
            },
            "documents": [{"name": "gem_order_spec.pdf", "url": "https://gem.gov.in/order.pdf", "type": "GEM_STATEMENT"}],
            "rawText": "GeM Solar PV installation bid BREDA. Net metering installation Bettiah. Exemption on EMD for registered units."
        }
