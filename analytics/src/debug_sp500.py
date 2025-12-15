import pandas as pd
import lxml

def test_loader():
    print("Testing S&P 500 Load...")
    KNOWN = {}
    try:
        tables = pd.read_html('https://en.wikipedia.org/wiki/List_of_S%26P_500_companies')
        print(f"Tables found: {len(tables)}")
        df = tables[0]
        print(f"Rows: {len(df)}")
        print("First 5 rows:")
        print(df[['Symbol', 'Security']].head())
    except Exception as e:
        print(f"FAILED: {e}")

if __name__ == "__main__":
    test_loader()
