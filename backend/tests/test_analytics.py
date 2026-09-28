"""Unit and integration tests for AnalyticsService and visual analytics endpoints."""
from fastapi.testclient import TestClient
from app.main import app
from app.services.analytics import AnalyticsService

client = TestClient(app)


def test_analytics_service_csv():
    csv_bytes = b"""order_id,category,quantity,price,total_revenue
ORD1,Electronics,5,100.0,500.0
ORD2,Electronics,2,100.0,200.0
ORD3,Apparel,10,25.0,250.0
ORD4,Apparel,4,25.0,100.0
ORD5,Home,1,150.0,150.0
"""
    analytics = AnalyticsService.generate_analytics("test.csv", csv_bytes)
    assert analytics is not None
    assert len(analytics.kpis) >= 3
    assert analytics.bar_chart is not None
    assert len(analytics.bar_chart.points) == 3
    assert analytics.histogram is not None
    assert len(analytics.histogram.bins) > 0


def test_zee_demo_endpoint():
    response = client.get("/api/v1/analytics/demo/zee")
    assert response.status_code == 200
    data = response.json()

    assert data["filename"] == "zee_ecommerce_report_2026.csv"
    assert "classifications" in data
    assert "analytics" in data
    analytics = data["analytics"]
    assert analytics is not None

    # Check KPIs
    labels = [k["label"] for k in analytics["kpis"]]
    assert "Total Records" in labels

    # Check Bar Chart
    assert analytics["bar_chart"] is not None
    assert len(analytics["bar_chart"]["points"]) == 5
    assert analytics["bar_chart"]["points"][0]["label"] == "Electronics"

    # Check Pie Chart
    assert analytics["pie_chart"] is not None
    assert len(analytics["pie_chart"]["slices"]) == 3

    # Check Histogram
    assert analytics["histogram"] is not None
    assert len(analytics["histogram"]["bins"]) > 0
