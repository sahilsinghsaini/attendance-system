from math import radians,sin,cos,sqrt,atan2
def haversine_meters(lat1,lon1,lat2,lon2):
    R=6371000
    p1,p2=radians(lat1),radians(lat2); dp=radians(lat2-lat1); dl=radians(lon2-lon1)
    a=sin(dp/2)**2+cos(p1)*cos(p2)*sin(dl/2)**2
    return 2*R*atan2(sqrt(a),sqrt(1-a))
def validate_gps(office,lat,lon,accuracy):
    if not (-90 <= lat <= 90):
        return False,"INVALID_LATITUDE"

    if not (-180 <= lon <= 180):
        return False,"INVALID_LONGITUDE"

    if accuracy is None:
        return False,"GPS_ACCURACY_REQUIRED"

    if accuracy > office.maximum_gps_accuracy_meters:
        return False,"GPS_ACCURACY"
    distance=haversine_meters(lat,lon,office.latitude,office.longitude)
    return distance<=office.geofence_radius_meters, ("OK" if distance<=office.geofence_radius_meters else "GPS_OUTSIDE_GEOFENCE")
