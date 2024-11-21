// 点的生成和模拟相关函数
class PointSimulation {
  constructor(projection, width, height) {
    this.projection = projection;
    this.width = width;
    this.height = height;
    this.pointsPerBorough = 400;
  }

  // 生成点数据
  generatePoints(features) {
    const points = [];
    
    features.forEach((feature) => {
      const bounds = d3.geoBounds(feature);
      let validPoints = 0;

      // 检查是否是曼哈顿或布鲁克林
      const isManhattan = feature.properties.name === "Manhattan";
      const isBrooklyn = feature.properties.name === "Brooklyn";
      
      while (validPoints < this.pointsPerBorough) {
        let point;
        
        if (isManhattan) {
          // 对曼哈顿使用特殊的点生成逻辑（更多点在下部）
          const yBias = Math.pow(Math.random(), 2); // 使用平方来增加下部的概率
          point = [
            bounds[0][0] + Math.random() * (bounds[1][0] - bounds[0][0]),
            bounds[0][1] + yBias * (bounds[1][1] - bounds[0][1])
          ];
        } else if (isBrooklyn) {
          // 对布鲁克林使用相反的逻辑（更多点在上部）
          const yBias = 1 - Math.pow(Math.random(), 2); // 使用反向平方来增加上部的概率
          point = [
            bounds[0][0] + Math.random() * (bounds[1][0] - bounds[0][0]),
            bounds[0][1] + yBias * (bounds[1][1] - bounds[0][1])
          ];
        } else {
          // 其他区域使用普通的随机分布
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

  // 创建热力图数据
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

  // 创建热力图渐变
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

  // 应用力导向模拟
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