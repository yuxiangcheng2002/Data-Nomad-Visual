// Add debugging information
console.log("Script loading started...");

// Set map dimensions
const width = window.innerWidth;
const height = window.innerHeight;
const margin = { top: 0, right: 0, bottom: 0, left: 0 };

try {
  // Create SVG container
  const svg = d3
    .select("#map")
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height]);

  // Create a container group
  const g = svg.append("g");

  // Modify projection settings - fixed view, focused on Manhattan center
  const projection = d3
    .geoMercator()
    .center([-73.98, 40.75])
    .scale(250000)
    .translate([width / 2, height / 2]);

  // Create path generator
  const path = d3.geoPath().projection(projection);

  // Create tooltip
  const tooltip = d3
    .select("body")
    .append("div")
    .attr("class", "tooltip")
    .style("opacity", 0);

  console.log("Loading geographic data...");

  // Load local GeoJSON file
  d3.json("new-york-city-boroughs.geojson")
    .then(function (nyc) {
      console.log("Geographic data loaded successfully", nyc);

      // Define point color
      const pointColor = "#9300ff";

      // Create defs element (only created once)
      const defs = svg.append("defs");

      // Create glow effect filter
      const filter = defs
        .append("filter")
        .attr("id", "glow")
        .attr("x", "-100%")
        .attr("y", "-100%")
        .attr("width", "300%")
        .attr("height", "300%");

      filter
        .append("feGaussianBlur")
        .attr("stdDeviation", "8")
        .attr("result", "coloredBlur");

      filter
        .append("feColorMatrix")
        .attr("type", "matrix")
        .attr(
          "values",
          `
          2 0 0 0 0.8
          0 2 0 0 0
          0 0 2 0 1.2
          0 0 0 2 0
        `
        );

      filter
        .append("feComponentTransfer")
        .append("feFuncA")
        .attr("type", "linear")
        .attr("slope", "1.5");

      filter
        .append("feComponentTransfer")
        .append("feFuncR")
        .attr("type", "linear")
        .attr("slope", "1.5");

      const feMerge = filter.append("feMerge");
      feMerge.append("feMergeNode").attr("in", "coloredBlur");
      feMerge.append("feMergeNode").attr("in", "SourceGraphic");

      // 在 defs 新的 filter
      const mergeFilter = defs
        .append("filter")
        .attr("id", "merge")
        .attr("x", "-50%")
        .attr("y", "-50%")
        .attr("width", "200%")
        .attr("height", "200%");

      mergeFilter
        .append("feGaussianBlur")
        .attr("in", "SourceGraphic")
        .attr("stdDeviation", "4")
        .attr("result", "blur");

      mergeFilter
        .append("feColorMatrix")
        .attr("in", "blur")
        .attr("type", "matrix")
        .attr("values", "1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 18 -7");

      // 在 defs 中添加热力图渐变
      const heatGradient = defs
        .append("linearGradient")
        .attr("id", "heatGradient");

      heatGradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", "#9300ff")
        .attr("stop-opacity", 0.03);

      heatGradient
        .append("stop")
        .attr("offset", "40%")
        .attr("stop-color", "#9300ff")
        .attr("stop-opacity", 0.3);

      heatGradient
        .append("stop")
        .attr("offset", "70%")
        .attr("stop-color", "#9300ff")
        .attr("stop-opacity", 0.5);

      heatGradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", "#9300ff")
        .attr("stop-opacity", 0.7);

      // Draw area boundaries first
      g.selectAll("path")
        .data(nyc.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("class", "borough")
        .style("fill", "none")
        .style("stroke", "#9300ff")
        .style("stroke-width", "1")
        .style("filter", "url(#glow)");

      // Then generate point data
      const points = [];
      const pointsPerBorough = 500;

      nyc.features.forEach((feature) => {
        const bounds = d3.geoBounds(feature);
        let validPoints = 0;

        while (validPoints < pointsPerBorough) {
          const point = [
            bounds[0][0] + Math.random() * (bounds[1][0] - bounds[0][0]),
            bounds[0][1] + Math.random() * (bounds[1][1] - bounds[0][1]),
          ];

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

      // 在生成点数据后，添加力导向模拟
      const simulation = d3
        .forceSimulation(points)
        .force(
          "x",
          d3.forceX((d) => projection(d.geometry.coordinates)[0]).strength(0.2)
        )
        .force(
          "y",
          d3.forceY((d) => projection(d.geometry.coordinates)[1]).strength(0.2)
        )
        .force("collide", d3.forceCollide().radius(16).strength(0.5))
        .force("charge", d3.forceManyBody().strength(5))
        .stop()
        .tick(50); // 运行50次迭代

      // 创建热力图层
      const heatmapData = d3
        .contourDensity()
        .x((d) => projection(d.geometry.coordinates)[0])
        .y((d) => projection(d.geometry.coordinates)[1])
        .size([width, height])
        .bandwidth(80)
        .thresholds(30)(points);

      // 绘制热力图
      g.selectAll("path.heat")
        .data(heatmapData)
        .enter()
        .append("path")
        .attr("class", "heat")
        .attr("d", d3.geoPath())
        .style("fill", "url(#heatGradient)")
        .style("opacity", (d) => Math.pow(d.value, 0.5) * 6)
        .style("mix-blend-mode", "screen");

      // 修改点的绘制，使其更小且更透明
      g.selectAll("circle")
        .data(points)
        .enter()
        .append("circle")
        .attr("cx", (d) => projection(d.geometry.coordinates)[0])
        .attr("cy", (d) => projection(d.geometry.coordinates)[1])
        .attr("r", 8)
        .style("fill", "#9300ff")
        .style("opacity", 0.15)
        .style("mix-blend-mode", "screen")
        .on("mouseover", function (event, d) {
          const circle = d3.select(this);
          const circleBox = circle.node().getBoundingClientRect();
          const circleX = circleBox.left + circleBox.width / 2;
          const circleY = circleBox.top + circleBox.height / 2;

          // 更新点的样式
          circle.transition().duration(200).attr("r", 12).style("opacity", 0.3);

          // 更新信息窗口内容
          d3.select(".info-window")
            .style("opacity", "1")
            .select(".stat-value")
            .text(d.properties.value.toFixed(2));

          d3.select(".info-window")
            .select(".stat-label")
            .text(d.properties.borough);

          // 获取信息窗口位置
          const infoWindow = document.querySelector(".info-window");
          const infoRect = infoWindow.getBoundingClientRect();
          const windowX = infoRect.left + infoRect.width / 2;
          const windowY = infoRect.bottom;

          // 检查点是否在窗口���方
          if (circleY < windowY) {
            // 点在窗口上方，只显示直线
            verticalLine.style("opacity", 0);
            connectingLine
              .attr("x1", windowX)
              .attr("y1", windowY)
              .attr("x2", circleX)
              .attr("y2", circleY)
              .style("opacity", 0.5);
          } else {
            // 点在窗口下方，显示两段线
            const totalDistance = Math.sqrt(
              Math.pow(circleX - windowX, 2) + Math.pow(circleY - windowY, 2)
            );
            // 增加垂直段长度比例到30%
            const verticalLength = totalDistance * 0.3;

            verticalLine
              .attr("x1", windowX)
              .attr("y1", windowY)
              .attr("x2", windowX)
              .attr("y2", windowY + verticalLength)
              .style("opacity", 0.5);

            connectingLine
              .attr("x1", windowX)
              .attr("y1", windowY + verticalLength)
              .attr("x2", circleX)
              .attr("y2", circleY)
              .style("opacity", 0.5);
          }
        })
        .on("mouseout", function () {
          d3.select(this)
            .transition()
            .duration(200)
            .attr("r", 8)
            .style("opacity", 0.15);

          // 延迟隐藏信息窗口和连接线
          d3.select(".info-window")
            .transition()
            .delay(1000) // 添加1秒延迟
            .duration(500) // 增加淡出时间
            .style("opacity", "0");

          verticalLine
            .transition()
            .delay(1000) // 匹配窗口延迟
            .duration(500)
            .style("opacity", 0);

          connectingLine
            .transition()
            .delay(1000) // 匹配窗口延迟
            .duration(500)
            .style("opacity", 0);
        });

      // 创建两个独立的SVG层用于连接线
      const lineLayer1 = d3
        .select("body")
        .append("svg")
        .style("position", "fixed")
        .style("top", 0)
        .style("left", 0)
        .style("width", "100%")
        .style("height", "100%")
        .style("pointer-events", "none")
        .style("z-index", 899);

      const lineLayer2 = d3
        .select("body")
        .append("svg")
        .style("position", "fixed")
        .style("top", 0)
        .style("left", 0)
        .style("width", "100%")
        .style("height", "100%")
        .style("pointer-events", "none")
        .style("z-index", 899);

      // 分别创建两条线
      const verticalLine = lineLayer1
        .append("line")
        .style("stroke", "#ffffff")
        .style("stroke-width", "3")
        .style("stroke-dasharray", "8,6")
        .style("opacity", 0)
        .style("filter", "drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))");

      const connectingLine = lineLayer2
        .append("line")
        .style("stroke", "#ffffff")
        .style("stroke-width", "3")
        .style("stroke-dasharray", "8,6")
        .style("opacity", 0)
        .style("filter", "drop-shadow(0 0 8px rgba(255, 255, 255, 0.8))");

      console.log("Map rendering complete");
      document.getElementById(
        "debug-info"
      ).innerHTML += `<p>Successfully rendered ${nyc.features.length} areas</p>`;
    })
    .catch(function (error) {
      console.error("Error loading data:", error);
      document.getElementById(
        "debug-info"
      ).innerHTML += `<p style="color: red;">Data loading error: ${error.message}</p>`;
    });
} catch (error) {
  console.error("Execution error:", error);
  document.getElementById(
    "debug-info"
  ).innerHTML += `<p style="color: red;">Execution error: ${error.message}</p>`;
}
