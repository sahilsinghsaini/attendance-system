from app.services.geofence_service import haversine_meters
def test_same_point():
    assert haversine_meters(28.6139,77.2090,28.6139,77.2090)==0
def test_distance_is_server_calculable():
    assert 100 < haversine_meters(28.6139,77.2090,28.6149,77.2090) < 120
