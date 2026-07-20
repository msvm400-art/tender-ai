import random
import time

class BaseScraper:
    def __init__(self, name="BaseScraper"):
        self.name = name
        self.user_agents = [
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Mobile Safari/537.36"
        ]

    def get_headers(self):
        return {
            "User-Agent": random.choice(self.user_agents),
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.5",
            "Connection": "keep-alive"
        }

    def rate_limit_delay(self):
        # Respectful rate limiting
        time.sleep(2.0)

    def scrape_listing(self, page=1):
        raise NotImplementedError("Subclasses must implement scrape_listing")

    def scrape_detail(self, tender_id):
        raise NotImplementedError("Subclasses must implement scrape_detail")

    def parse_pdf(self, pdf_url):
        # Mock pdf extraction
        return "EXTRACTED DOCUMENT CORPUS TEXT: General procurement specifications, eligibility requirements, EMD compliance and class A contractor guidelines."
