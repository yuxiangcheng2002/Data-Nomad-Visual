// Global variables
const width = window.innerWidth;
const height = window.innerHeight;
const margin = { top: 0, right: 0, bottom: 0, left: 0 };
let points; // Store all points
let g; // Store the main SVG group
let projection; // Store the projection

// Time control object
const timeControl = {
  currentDate: new Date(),
  selectedDate: new Date(),
  selectedMinutes: 0,
  isCurrentDate: true,
  isPlaying: false,
  playInterval: null,
  playSpeed: 10,
  playStepSize: 5,

  initialize() {
    const datePicker = document.getElementById("date-picker");
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];
    datePicker.value = dateStr;
    datePicker.max = dateStr;

    const timeSlider = document.getElementById("time-slider");
    const currentMinutes = today.getHours() * 60 + today.getMinutes();
    timeSlider.value = currentMinutes;
    this.selectedMinutes = currentMinutes;

    this.updateTimeDisplay();

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

    if (this.isCurrentDate) {
      this.startRealtimeUpdate();
    }

    const playButton = document.getElementById("play-button");
    playButton.addEventListener("click", () => this.togglePlay());
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

    this.updatePointsVisibility();
  },

  updatePointsVisibility() {
    if (!points) return;

    const currentMinutes = this.selectedMinutes;

    // Get visible points
    const visiblePoints = points.filter((d) => {
      const pointMinutes =
        d.properties.timestamp.getHours() * 60 +
        d.properties.timestamp.getMinutes();
      return pointMinutes <= currentMinutes;
    });

    // Update points visibility
    d3.selectAll("circle").style("display", (d) => {
      const pointMinutes =
        d.properties.timestamp.getHours() * 60 +
        d.properties.timestamp.getMinutes();
      return pointMinutes <= currentMinutes ? null : "none";
    });

    // Update heat contours
    if (visiblePoints.length > 0) {
      // Generate new contour data based on visible points
      const contours = d3
        .contourDensity()
        .x((d) => projection(d.geometry.coordinates)[0])
        .y((d) => projection(d.geometry.coordinates)[1])
        .weight((d) => d.properties.sensor1) // Use sensor1 value for heat intensity
        .size([width, height])
        .bandwidth(80)
        .thresholds(25)
        .cellSize(2)(visiblePoints);

      // Remove existing heat paths
      g.selectAll("path.heat").remove();

      // Add new heat paths
      g.insert("g", ".points")
        .attr("class", "heat-layer")
        .selectAll("path")
        .data(contours)
        .enter()
        .append("path")
        .attr("class", "heat")
        .attr("d", d3.geoPath())
        .style("fill", "url(#heatGradient)")
        .style("opacity", (d) => Math.pow(d.value, 0.3) * 6)
        .style("mix-blend-mode", "screen");
    } else {
      // Remove heat if no points are visible
      g.selectAll("path.heat").remove();
    }
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
    timeSlider.max = 1439;
  },

  startRealtimeUpdate() {
    setInterval(() => {
      if (this.isCurrentDate) {
        this.updateSliderConstraints();
      }
    }, 1000);
  },

  togglePlay() {
    const playButton = document.getElementById("play-button");
    if (this.isPlaying) {
      this.stopPlay();
      playButton.textContent = "▶";
      playButton.classList.remove("playing");
    } else {
      // Reset to start of day when starting to play
      this.selectedMinutes = 0;
      document.getElementById("time-slider").value = 0;
      this.updateTimeDisplay();

      this.startPlay();
      playButton.textContent = "⏸";
      playButton.classList.add("playing");
    }
    this.isPlaying = !this.isPlaying;
  },

  startPlay() {
    if (this.playInterval) clearInterval(this.playInterval);

    this.playInterval = setInterval(() => {
      let newMinutes = this.selectedMinutes + this.playStepSize;

      // Check if we should stop based on date type
      if (this.isCurrentDate) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        if (newMinutes > currentMinutes) {
          newMinutes = currentMinutes;
          this.stopPlay();
        }
      } else if (newMinutes >= 1440) {
        // End of day for past dates
        newMinutes = 1439;
        this.stopPlay();
      }

      // Update slider and time
      this.selectedMinutes = newMinutes;
      document.getElementById("time-slider").value = newMinutes;
      this.updateTimeDisplay();
    }, this.playSpeed);
  },

  stopPlay() {
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    this.isPlaying = false;
    const playButton = document.getElementById("play-button");
    playButton.textContent = "▶";
    playButton.classList.remove("playing");
  },
};

try {
  // Create SVG container
  const svg = d3
    .select("#map")
    .append("svg")
    .attr("width", "100%")
    .attr("height", height)
    .attr("viewBox", [0, 0, width, height]);

  // Create a container group and assign to global variable
  g = svg.append("g");

  // Create layers in correct order
  const boundariesLayer = g.append("g").attr("class", "boundaries");
  const heatLayer = g.append("g").attr("class", "heat-layer");
  const pointsLayer = g.append("g").attr("class", "points");

  // Assign projection to global variable
  projection = d3
    .geoMercator()
    .center([-73.98, 40.75])
    .scale(250000)
    .translate([width / 2, height / 2]);

  const path = d3.geoPath().projection(projection);

  // Load local GeoJSON file
  d3.json("new-york-city-boroughs.geojson")
    .then(function (nyc) {
      // Create defs and filters
      const defs = svg.append("defs");

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

      // Draw boundaries
      boundariesLayer
        .selectAll("path")
        .data(nyc.features)
        .enter()
        .append("path")
        .attr("d", path)
        .attr("class", "borough")
        .style("fill", "none")
        .style("stroke", "#9300ff")
        .style("stroke-width", "1")
        .style("filter", "url(#glow)");

      // Generate points
      const pointSim = new PointSimulation(projection, width, height);
      points = pointSim.generatePoints(nyc.features);

      // Create heat gradient
      pointSim.createHeatGradient(defs);

      // Draw points
      pointsLayer
        .selectAll("circle")
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

          circle.transition().duration(200).attr("r", 12).style("opacity", 0.3);

          const infoWindow = d3.select(".info-window");

          infoWindow.interrupt();

          infoWindow
            .style("opacity", "1")
            .select(".stat-value")
            .text(d.properties.value.toFixed(2));

          infoWindow.select(".stat-label").text(d.properties.borough);

          infoWindow.selectAll("p").remove(); // 先清除已有的 p 元素

          infoWindow
            .append("p")
            .text(`Timestamp: ${d.properties.timestamp.toLocaleTimeString()}`);

          infoWindow
            .append("p")
            .text(`Sensor1: ${d.properties.sensor1.toFixed(2)}`);

          const infoWindow_el = document.querySelector(".info-window");
          const infoRect = infoWindow_el.getBoundingClientRect();
          const windowX = infoRect.left + infoRect.width / 2;
          const windowY = infoRect.bottom;

          if (circleY < windowY) {
            verticalLine.style("opacity", 0);
            connectingLine
              .attr("x1", windowX)
              .attr("y1", windowY)
              .attr("x2", circleX)
              .attr("y2", circleY)
              .style("opacity", 0.5);
          } else {
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

          verticalLine.style("opacity", 0);
          connectingLine.style("opacity", 0);

          const infoWindow = d3.select(".info-window");
          infoWindow
            .transition()
            .duration(500)
            .style("opacity", "0")
            .end()
            .then(() => {
              infoWindow.selectAll("p").remove();
            });
        });

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

      // Initialize time control
      timeControl.initialize();
      timeControl.updatePointsVisibility();

      // Hide loading screen when everything is ready
      const loadingScreen = document.getElementById('loading-screen');
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 1000); // Wait for fade out animation to complete

    })
    .catch(function (error) {
      console.error("Error loading data:", error);
      // Show error on loading screen if something goes wrong
      document.querySelector('.loading-quote').textContent = 'Error loading map data';
    });

} catch (error) {
  console.error("Execution error:", error);
  // Show error on loading screen if something goes wrong
  document.querySelector('.loading-quote').textContent = 'Error initializing map';
}

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
    startTime.setHours(0, 0, 0, 0);

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
          const xBias = Math.pow(Math.random(), 2);
          const yBias = 1 - Math.pow(Math.random(), 2);
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
          const randomMinutes = Math.floor(Math.random() * 1440);
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
      .weight((d) => d.properties.sensor1)
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
