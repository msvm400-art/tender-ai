from .base import BaseScraper
import datetime

class CPPPScraper(BaseScraper):
    def __init__(self):
        super().__init__(name="CPPPScraper")

    def scrape_listing(self, page=1):
        print(f"[{self.name}] Scraping listing page {page}")
        self.rate_limit_delay()
        # Mocking listings
        return ["CPPP/2026/BR/001", "CPPP/2026/JH/012"]

    def scrape_detail(self, tender_id):
        print(f"[{self.name}] Scraping detail for ID: {tender_id}")
        self.rate_limit_delay()
        
        return {
            "externalId": tender_id,
            "sourcePortal": "CPPP",
            "title": "Expansion and Allied Laying of Academies and Dormitories at CPWD Centered Campus",
            "department": "Central Public Works Department (CPWD)",
            "state": "Bihar",
            "category": "Construction",
            "tenderValue": 5.80,
            "emdAmount": 11.6,
            "publishedDate": datetime.datetime.now().isoformat(),
            "bidSubmissionDeadline": (datetime.datetime.now() + datetime.timedelta(days=20)).isoformat(),
            "workDescription": "Public civil excavation and construction of block components. Heavy technical specifications apply.",
            "eligibilityCriteria": {
                "minTurnover": 2.5,
                "minExperience": 5,
                "requiredCertifications": ["Class A Contractor License"],
                "msmeOnly": False
            },
            "documents": [{"name": "notice.pdf", "url": "https://cppp.gov.in/notice.pdf", "type": "NOTICE"}],
            "rawText": "Central Public Works Department CPWD tender. Target estimates 5.8 Crores. Experience of 5 years civil category and turnovers above 2.5 Crores."
        }
