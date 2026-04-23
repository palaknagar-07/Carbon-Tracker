function serializeRouteCoordinatesForFirestore(route = [], maxPoints = route.length) {
  if (!Array.isArray(route)) return [];

  return route.slice(0, maxPoints).map((point) => ({
    lat: Number(point?.[0]),
    lng: Number(point?.[1])
  }));
}

module.exports = {
  serializeRouteCoordinatesForFirestore
};
