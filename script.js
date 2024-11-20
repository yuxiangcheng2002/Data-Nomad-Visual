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

      // Modify gradient settings
      const gradient = defs
        .append("radialGradient")
        .attr("id", "pointGradient")
        .attr("cx", "50%")
        .attr("cy", "50%")
        .attr("r", "50%")
        .attr("fx", "50%")
        .attr("fy", "50%");

      gradient
        .append("stop")
        .attr("offset", "0%")
        .attr("stop-color", pointColor)
        .attr("stop-opacity", 0.4); // Increase center opacity

      gradient
        .append("stop")
        .attr("offset", "70%")
        .attr("stop-color", pointColor)
        .attr("stop-opacity", 0.2); // Increase middle opacity

      gradient
        .append("stop")
        .attr("offset", "100%")
        .attr("stop-color", pointColor)
        .attr("stop-opacity", 0);

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
      const pointsPerBorough = 100;

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
        .style("stroke", "#9300ff")
        .style("stroke-width", "3")
        .style("stroke-dasharray", "8,6")
        .style("opacity", 0)
        .style("filter", "drop-shadow(0 0 8px rgba(147, 0, 255, 0.8))");

      const connectingLine = lineLayer2
        .append("line")
        .style("stroke", "#9300ff")
        .style("stroke-width", "3")
        .style("stroke-dasharray", "8,6")
        .style("opacity", 0)
        .style("filter", "drop-shadow(0 0 8px rgba(147, 0, 255, 0.8))");

      // 修改点的交互
      g.selectAll("circle")
        .data(points)
        .enter()
        .append("circle")
        .attr("cx", (d) => projection(d.geometry.coordinates)[0])
        .attr("cy", (d) => projection(d.geometry.coordinates)[1])
        .attr("r", 24)
        .style("fill", "url(#pointGradient)")
        .style("mix-blend-mode", "plus-lighter")
        .on("mouseover", function (event, d) {
          const circle = d3.select(this);
          const circleBox = circle.node().getBoundingClientRect();
          const circleX = circleBox.left + circleBox.width / 2;
          const circleY = circleBox.top + circleBox.height / 2;

          // 更新点的样式
          circle
            .transition()
            .duration(200)
            .attr("r", 32)
            .style("filter", "brightness(1.5)");

          // 显示信息窗口
          const infoWindow = document.querySelector(".info-window");
          infoWindow.style.opacity = "1";

          // 更新信息窗口内容
          document.querySelector(".stat-value").textContent =
            d.properties.value.toFixed(2);
          document.querySelector(
            ".stat-label"
          ).textContent = `${d.properties.borough}`;

          // 获取信息窗口位置
          const infoRect = infoWindow.getBoundingClientRect();
          const windowX = infoRect.left + infoRect.width / 2;
          const windowY = infoRect.bottom;

          // 检查点是否在窗口上方
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

          // 显示工具提示
          tooltip.transition().duration(200).style("opacity", 0.9);
          tooltip
            .html(
              `Area: ${d.properties.borough}<br/>
               Value: ${d.properties.value.toFixed(2)}<br/>
               Lat: ${d.geometry.coordinates[1].toFixed(4)}<br/>
               Lng: ${d.geometry.coordinates[0].toFixed(4)}`
            )
            .style("left", event.pageX + 10 + "px")
            .style("top", event.pageY - 28 + "px");
        })
        .on("mouseout", function (event, d) {
          // 恢复点的样式
          d3.select(this)
            .transition()
            .duration(200)
            .attr("r", 24)
            .style("filter", "none");

          // 隐藏信息窗口
          document.querySelector(".info-window").style.opacity = "0";

          // 隐藏连接线
          verticalLine.style("opacity", 0);
          connectingLine.style("opacity", 0);

          // 隐藏工具提示
          tooltip.transition().duration(500).style("opacity", 0);
        });

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
