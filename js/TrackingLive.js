var CAMERA_DEFAULT_SPEED = 50;

/**
* Creates a TrackingLive object
*
* @constructor
* @this {CameraTracking}
* @param {THREE.Camera} camera : A three.js camera
*/
ARC3D.TrackingLive = function(camera) {
    this.camera = camera;
    this.isRunning = false;
    this.isPaused = false;
    this.speed = CAMERA_DEFAULT_SPEED;

    this.path = [];
    this.splines = [];
    this.splineLength = -1.0;
    this.distance = 0.0;

    this.fromQuaternion = undefined;
    this.elevatorQuaternion = undefined;

    /**
    * Set the path the camera shall follow.
    *
    * @param {Array} path : Array of THREE.Vector3 (the positions)
    * @return {Curve3} The curve created for the pathfinding.
    */
    this.setPath = function(path) {
        this.path = pathfinder.getPathPositions(path);
        this.splines = [];

        var fromElevator = false;
        var curve = new THREE.CatmullRomCurve3();
        var curvename = 'normal';

        // Create the curves
        for(var i = 0; i < path.length; i++){
            var p = this.path[i];
            var n = pathfinder.getNode(path[i]);
            var on = pathfinder.getNode(path[i - 1]);

            if(i > 1)
                curvename = on.name == 'elevator' ? 'elevator' : 'normal';

            // Create a new curve, and add it to the splines array
            if((n.name == 'elevator' && !fromElevator) || (n.name != 'elevator' && fromElevator))
            {
                // Push it if entering elevator
                if(n.name == 'elevator'){curve.points.push(p);}

                this.splines.push({curve: curve, curvename: curvename});

                curve = new THREE.CatmullRomCurve3();

                if(n.name != 'elevator'){curve.points.push(this.path[i - 1]);}
            }

            // Add the point to the current created curve
            curve.points.push(p);

            // Set past node state
            if(n.name == 'elevator'){
                fromElevator = true;
            }else{
                fromElevator = false;
            }
        }

        // Add the remaining curve if it got at leaste one point.
        if(curve.points.length > 0)
        {
            console.log("yup but: " + curvename);
            this.splines.push({curve: curve, curvename: curvename});
        }

        // Compute spline total length
        this.splineLength = 0.0;
        for(i = 0; i < this.splines.length; i++)
        {
            this.splineLength += this.splines[i].curve.getLength();
        }

        console.log("Spline is made of " + this.splines.length + " curves");

        return this.splines;
    };

    /**
    * Set the camera mode to running.
    */
    this.start = function(){
        this.isRunning = true;
        this.distance = 0.0;
        this.isPaused = false;

        this.camera.position.copy(this.splines[0].curve.getPointAt(0.0));

        this.fromQuaternion = undefined;
        this.elevatorQuaternion = undefined;
    };

    /**
    * Stop and reset the camera.
    */
    this.stop = function(){
        this.isRunning = false;
    };

    /**
    * Toggle pause mode
    * @return True if now it's in pause. False if it's not
    */
    this.togglePause = function(){
        this.isPaused = !this.isPaused;
        return this.isPaused;
    };

    /**
    * Update the camera position. Have to be called every frame.
    *
    * @param {Number} delta : Delta time since the last frame
    */
    this.update = function(delta){
        if(!this.isRunning || this.isPaused)
            return;

        this.distance += delta * this.speed;

        if(this.distance > this.splineLength){
            this.stop();
            return;
        }

        if(!this.setCameraAt(this.distance)){
            this.distance -= delta * this.speed;
        }
    };

    this.setCameraAt = function(t)
    {
        var distanceCurrentSpline = t;
        var currentSplineId;

        for(var i = 0; i < this.splines.length; i++)
        {
            var sl = this.splines[i].curve.getLength();
            if (distanceCurrentSpline - sl < 0.0)
            {
                currentSplineId = i;
                break;
            }
            distanceCurrentSpline -= sl;
        }

        var currentSpline = this.splines[currentSplineId].curve;
        var currentSplineName = this.splines[currentSplineId].curvename;
        var currentSplineLength = currentSpline.getLength();

        var distanceLookat = distanceCurrentSpline + 100.0;
        distanceLookat = distanceLookat < currentSplineLength ? distanceLookat : currentSplineLength;

        // t belongs to [0,1]
        var t_position = distanceCurrentSpline / currentSplineLength;
        var t_lookat = distanceLookat / currentSplineLength;

        var p_position = currentSpline.getPointAt(t_position);
        var p_lookat = currentSpline.getPointAt(t_lookat);

        var frustum = new THREE.Frustum();
        var projScreenMatrix = new THREE.Matrix4();
        projScreenMatrix.multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse );

        frustum.setFromMatrix( new THREE.Matrix4().multiplyMatrices( camera.projectionMatrix, camera.matrixWorldInverse ) );

        // Only move the camera if the user is aiming at the path.
        if(frustum.containsPoint(p_lookat)){
            this.camera.position.copy(p_position);
            return true;
        }else{
            return false;
        }


    };

    /**
    * Set the camera velocity
    *
    * @param {Number} speed : The speed to set
    */
    this.setSpeed = function (speed) {
        this.speed = speed;
    };
};
