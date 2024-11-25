class PointSimulation {
  constructor(projection, width, height) {
    this.projection = projection;
    this.width = width;
    this.height = height;
    this.pointsPerBorough = 400;
  }

  generatePoints(features) {
    const points = [];
    
    features.forEach((feature) => {
      const bounds = d3.geoBounds(feature);
      let validPoints = 0;

      const isManhattan = feature.properties.name === "Manhattan";
      const isBrooklyn = feature.properties.name === "Brooklyn";
      
      while (validPoints < this.pointsPerBorough) {
        let point;
        
        if (isManhattan) {
          const yBias = Math.pow(Math.random(), 2);
          point = [
            bounds[0][0] + Math.random() * (bounds[1][0] - bounds[0][0]),
            bounds[0][1] + yBias * (bounds[1][1] - bounds[0][1])
          ];
        } else if (isBrooklyn) {
          const yBias = 1 - Math.pow(Math.random(), 2);
          point = [
            bounds[0][0] + Math.random() * (bounds[1][0] - bounds[0][0]),
            bounds[0][1] + yBias * (bounds[1][1] - bounds[0][1])
          ];
        } else {
          point = [
            bounds[0][0] + Math.random() * (bounds[1][0] - bounds[0][0]),
            bounds[0][1] + Math.random() * (bounds[1][1] - bounds[0][1])
          ];
        }

        if (d3.geoContains(feature, point)) {
          points.push({
            type: "Feature",
            properties: {
              borough: feature.properties.name,
              value: Math.random() * 100,
            },
            geometry: {
              type: "Point",
              coordinates: point,
            },
          });
          validPoints++;
        }
      }
    });

    return points;
  }

  createHeatmapData(points) {
    return d3.contourDensity()
      .x(d => this.projection(d.geometry.coordinates)[0])
      .y(d => this.projection(d.geometry.coordinates)[1])
      .size([this.width, this.height])
      .bandwidth(80)
      .thresholds(25)
      .cellSize(2)
      (points);
  }

  createHeatGradient(defs) {
    const heatGradient = defs
      .append("linearGradient")
      .attr("id", "heatGradient");

    heatGradient
      .append("stop")
      .attr("offset", "0%")
      .attr("stop-color", "#9300ff")
      .attr("stop-opacity", 0.001);

    heatGradient
      .append("stop")
      .attr("offset", "30%")
      .attr("stop-color", "#9300ff")
      .attr("stop-opacity", 0.08);

    heatGradient
      .append("stop")
      .attr("offset", "60%")
      .attr("stop-color", "#9300ff")
      .attr("stop-opacity", 0.15);

    heatGradient
      .append("stop")
      .attr("offset", "80%")
      .attr("stop-color", "#9300ff")
      .attr("stop-opacity", 0.3);

    heatGradient
      .append("stop")
      .attr("offset", "100%")
      .attr("stop-color", "#9300ff")
      .attr("stop-opacity", 0.4);

    return heatGradient;
  }

  applyForceSimulation(points) {
    return d3.forceSimulation(points)
      .force("x", d3.forceX(d => this.projection(d.geometry.coordinates)[0]).strength(0.1))
      .force("y", d3.forceY(d => this.projection(d.geometry.coordinates)[1]).strength(0.1))
      .force("collide", d3.forceCollide().radius(12).strength(0.3))
      .force("charge", d3.forceManyBody().strength(3))
      .stop()
      .tick(20);
  }
}

export default PointSimulation; 