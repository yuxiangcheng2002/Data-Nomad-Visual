// Set map dimensions
const width = window.innerWidth;
const height = window.innerHeight;
const margin = { top: 0, right: 0, bottom: 0, left: 0 };

// 注释掉加载页面变量声明
// let loadingScreen = document.getElementById("loading-screen");

// 在文件顶部添加全局时间控制变量
const timeControl = {
  currentDate: new Date(),
  selectedDate: new Date(),
  selectedMinutes: 0,
  isCurrentDate: true,

  initialize() {
    // 设置日期选择器
    const datePicker = document.getElementById("date-picker");
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    datePicker.value = dateStr;
    datePicker.max = dateStr;

    // 设置时间滑块
    const timeSlider = document.getElementById("time-slider");
    const currentMinutes = today.getHours() * 60 + today.getMinutes();
    timeSlider.value = currentMinutes;
    this.selectedMinutes = currentMinutes;

    // 更新时间显示
    this.updateTimeDisplay();

    // 添加事件监听器
    datePicker.addEventListener("change", (e) => {
      const selectedDate = new Date(e.target.value);
      this.selectedDate = selectedDate;
      this.isCurrentDate = this.checkIfCurrentDate();
      this.updateTimeStatus();
      this.updateSliderConstraints();
    });

    timeSlider.addEventListener("input", (e) => {
      const newValue = parseInt(e.target.value);
      if (this.isCurrentDate) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        if (newValue > currentMinutes) {
          timeSlider.value = currentMinutes;
          this.selectedMinutes = currentMinutes;
        } else {
          this.selectedMinutes = newValue;
        }
      } else {
        this.selectedMinutes = newValue;
      }
      this.updateTimeDisplay();
    });

    // 如果是当前日期，启动实时更新
    if (this.isCurrentDate) {
      this.startRealtimeUpdate();
    }
  },

  checkIfCurrentDate() {
    const today = new Date();
    return this.selectedDate.toDateString() === today.toDateString();
  },

  updateTimeStatus() {
    const statusElement = document.querySelector(".time-status");
    statusElement.textContent = this.isCurrentDate ? "CURRENT" : "PAST";
    statusElement.className =
      "time-status " + (this.isCurrentDate ? "current" : "past");
  },

  updateTimeDisplay() {
    const hours = Math.floor(this.selectedMinutes / 60);
    const minutes = this.selectedMinutes % 60;
    const timeStr = `${hours.toString().padStart(2, "0")}:${minutes
      .toString()
      .padStart(2, "0")}`;
    document.querySelector(".time-display").textContent = timeStr;

    // 添加对点的更新
    this.updatePointsVisibility();
  },

  updatePointsVisibility() {
    d3.selectAll("circle").style("display", (d) => {
      const pointMinutes =
        d.properties.timestamp.getHours() * 60 +
        d.properties.timestamp.getMinutes();
      return pointMinutes <= this.selectedMinutes ? null : "none";
    });
  },

  updateSliderConstraints() {
    const timeSlider = document.getElementById("time-slider");
    if (this.isCurrentDate) {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      if (this.selectedMinutes > currentMinutes) {
        timeSlider.value = currentMinutes;
        this.selectedMinutes = currentMinutes;
        this.updateTimeDisplay();
      }
    }
    timeSlider.max = 1439; // 23:59
  },

  startRealtimeUpdate() {
    setInterval(() => {
      if (this.isCurrentDate) {
        this.updateSliderConstraints();
      }
    }, 1000); // 每秒更新一次
  },
};

try {
  // 初始化时间控制
  timeControl.initialize();

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

  // Load local GeoJSON file
  d3.json("new-york-city-boroughs.geojson")
    .then(function (nyc) {
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

      // 创建点模拟实例
      const pointSim = new PointSimulation(projection, width, height);

      // 生成点
      const points = pointSim.generatePoints(nyc.features);

      // 创建热力图渐变
      pointSim.createHeatGradient(defs);

      // 生成热力图数据
      const heatmapData = pointSim.createHeatmapData(points);

      // 应用力导向模拟
      pointSim.applyForceSimulation(points);

      // 在创建热力图之前添加地图边界的绘制
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

      // 然后是热力图和点的绘制
      // ... 其余代保持不变 ...

      // 绘制热力图
      g.selectAll("path.heat")
        .data(heatmapData)
        .enter()
        .append("path")
        .attr("class", "heat")
        .attr("d", d3.geoPath())
        .style("fill", "url(#heatGradient)")
        .style("opacity", (d) => Math.pow(d.value, 0.3) * 6)
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
        .style("pointer-events", "all")
        .on("mouseover", function (event, d) {
          const circle = d3.select(this);
          const circleBox = circle.node().getBoundingClientRect();
          const circleX = circleBox.left + circleBox.width / 2;
          const circleY = circleBox.top + circleBox.height / 2;

          // 更新点的样式
          circle.transition().duration(200).attr("r", 12).style("opacity", 0.3);

          // 更新信息窗口内容
          const infoWindow = d3.select(".info-window");

          // 清除之前的过渡效果
          infoWindow.interrupt();

          // 设置内容和显示
          infoWindow
            .style("opacity", "1")
            .select(".stat-value")
            .text(d.properties.value.toFixed(2));

          infoWindow.select(".stat-label").text(d.properties.borough);

          // 显示新的属性
          infoWindow.selectAll("p").remove(); // 先清除已有的 p 元素

          infoWindow
            .append("p")
            .text(`Timestamp: ${d.properties.timestamp.toLocaleTimeString()}`);

          infoWindow
            .append("p")
            .text(`Sensor1: ${d.properties.sensor1.toFixed(2)}`);

          // 修复获取信息窗口位置的代码
          const infoWindow_el = document.querySelector(".info-window");
          const infoRect = infoWindow_el.getBoundingClientRect();
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

          // 立即隐藏连接线
          verticalLine.style("opacity", 0);
          connectingLine.style("opacity", 0);

          // 只在鼠标真正离开时才淡出信息窗口
          const infoWindow = d3.select(".info-window");
          infoWindow
            .transition()
            .duration(500)
            .style("opacity", "0")
            .end() // 等待过渡完成
            .then(() => {
              // 过渡完成后清除内容
              infoWindow.selectAll("p").remove();
            });
        });

      // 创建两个独立SVG层用于连接线
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

      // 注释掉加载页面的淡出动画
      // setTimeout(() => {
      //   loadingScreen.style.opacity = "0";
      //   setTimeout(() => {
      //     loadingScreen.style.display = "none";
      //   }, 1000); // 等待淡出动画完成后隐藏元素
      // }, 500); // 延迟500ms开始淡出
    })
    .catch(function (error) {
      // console.error("Error loading data:", error);
      // document.getElementById(
      //   "debug-info"
      // ).innerHTML += `<p style="color: red;">Data loading error: ${error.message}</p>`;
    });
} catch (error) {
  // console.error("Execution error:", error);
  // document.getElementById(
  //   "debug-info"
  // ).innerHTML += `<p style="color: red;">Execution error: ${error.message}</p>`;
}

// Add the PointSimulation class definition at the top of script.js
class PointSimulation {
  constructor(projection, width, height) {
    this.projection = projection;
    this.width = width;
    this.height = height;
    this.pointsPerBorough = 400;
  }

  generatePoints(features) {
    const points = [];
    const startTime = new Date();
    startTime.setHours(0, 0, 0, 0); // 设置为当天的开始时间

    features.forEach((feature) => {
      const bounds = d3.geoBounds(feature);
      let validPoints = 0;
      const isManhattan = feature.properties.name === "Manhattan";
      const isBrooklyn = feature.properties.name === "Brooklyn";
      const isQueens = feature.properties.name === "Queens";

      while (validPoints < this.pointsPerBorough) {
        let point;

        if (isManhattan) {
          const yBias = Math.pow(Math.random(), 2);
          point = [
            bounds[0][0] + Math.random() * (bounds[1][0] - bounds[0][0]),
            bounds[0][1] + yBias * (bounds[1][1] - bounds[0][1]),
          ];
        } else if (isBrooklyn) {
          const yBias = 1 - Math.pow(Math.random(), 2);
          point = [
            bounds[0][0] + Math.random() * (bounds[1][0] - bounds[0][0]),
            bounds[0][1] + yBias * (bounds[1][1] - bounds[0][1]),
          ];
        } else if (isQueens) {
          // 对皇后区使用特殊的点生成逻辑
          const xBias = Math.pow(Math.random(), 2); // 西部偏好
          const yBias = 1 - Math.pow(Math.random(), 2); // 北部偏好
          point = [
            bounds[0][0] + xBias * (bounds[1][0] - bounds[0][0]),
            bounds[0][1] + yBias * (bounds[1][1] - bounds[0][1]),
          ];
        } else {
          point = [
            bounds[0][0] + Math.random() * (bounds[1][0] - bounds[0][0]),
            bounds[0][1] + Math.random() * (bounds[1][1] - bounds[0][1]),
          ];
        }

        if (d3.geoContains(feature, point)) {
          // 生成随机时间，但确保是递增的
          const randomMinutes = Math.floor(Math.random() * 1440); // 一天有1440分钟
          const timestamp = new Date(
            startTime.getTime() + randomMinutes * 60000
          );
          const sensor1 = Math.random() * 100;

          points.push({
            type: "Feature",
            properties: {
              borough: feature.properties.name,
              value: Math.random() * 100,
              timestamp: timestamp,
              sensor1: sensor1,
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

    // 初始化时立即更新点的可见性
    setTimeout(() => {
      timeControl.updatePointsVisibility();
    }, 0);

    return points;
  }

  createHeatmapData(points) {
    return d3
      .contourDensity()
      .x((d) => this.projection(d.geometry.coordinates)[0])
      .y((d) => this.projection(d.geometry.coordinates)[1])
      .size([this.width, this.height])
      .bandwidth(80)
      .thresholds(25)
      .cellSize(2)(points);
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
    return d3
      .forceSimulation(points)
      .force(
        "x",
        d3
          .forceX((d) => this.projection(d.geometry.coordinates)[0])
          .strength(0.1)
      )
      .force(
        "y",
        d3
          .forceY((d) => this.projection(d.geometry.coordinates)[1])
          .strength(0.1)
      )
      .force("collide", d3.forceCollide().radius(12).strength(0.3))
      .force("charge", d3.forceManyBody().strength(3))
      .stop()
      .tick(20);
  }
}
