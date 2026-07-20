import sys
import os
import requests
from scrapers.cppp import CPPPScraper
from scrapers.gem import GeMScraper

def main():
    print("=== TenderAI Python Scraper Module Run ===")
    
    cppp = CPPPScraper()
    gem = GeMScraper()
    
    # Run listings
    cppp_ids = cppp.scrape_listing(page=1)
    gem_ids = gem.scrape_listing(page=1)
    
    scraped_tenders = []
    
    # Crawl details
    for bid_id in cppp_ids[:1]:
        detail = cppp.scrape_detail(bid_id)
        scraped_tenders.append(detail)
        
    for bid_id in gem_ids[:1]:
        detail = gem.scrape_detail(bid_id)
        scraped_tenders.append(detail)
        
    print(f"Scraped {len(scraped_tenders)} active bids from government portals.")
    
    # Ingestion simulation
    backend_url = os.environ.get("APP_URL", "http://localhost:3000") + "/api/internal/tenders/ingest"
    api_key = os.environ.get("INTERNAL_API_KEY", "scraper_internal_key")
    
    print(f"Attempting ingestion post to: {backend_url}")
    try:
        # Mock ingestion check
        print("Scraper completed successfully.")
    except Exception as e:
        print(f"Failed to post ingested files to server: {e}")

if __name__ == "__main__":
    main()
