import nltk
from nltk.sentiment.vader import SentimentIntensityAnalyzer

print("Testing NLTK VADER...")
try:
    try:
        nltk.data.find('sentiment/vader_lexicon.zip')
        print("Lexicon found.")
    except LookupError:
        print("Downloading lexicon...")
        nltk.download('vader_lexicon')
        print("Lexicon downloaded.")

    sia = SentimentIntensityAnalyzer()
    
    samples = [
        "Apple reports record earnings, stock soars!",
        "Company faces huge lawsuit, impending bankruptcy.",
        "The market is open today."
    ]

    for s in samples:
        score = sia.polarity_scores(s)
        print(f"'{s}' -> {score['compound']}")

except Exception as e:
    print(f"Error: {e}")
