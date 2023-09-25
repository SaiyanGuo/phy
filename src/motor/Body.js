import { Object3D, Vector3, Group, Mesh, LineSegments, BufferGeometry, CylinderGeometry, InstancedMesh, DynamicDrawUsage, Matrix4 } from 'three';

import { root, Utils } from './root.js';

import { Geo } from './base/Geo.js';
import { Mat, Colors } from './base/Mat.js';

import { Item } from '../core/Item.js';
import { Num } from '../core/Config.js';
import { Basic3D } from '../core/Basic3D.js';
import { Instance } from '../core/Instance.js';
import { MathTool, PI90, todeg } from '../core/MathTool.js';

import { SphereBox, Capsule, ChamferCyl, ChamferBox, createUV, Stair  } from '../3TH/Geometry.js';
import { ConvexGeometry } from '../jsm/geometries/ConvexGeometry.js';



import { CapsuleHelper  } from '../3TH/helpers/CapsuleHelper.js';


// THREE BODY

export class Body extends Item {

	constructor () {

		super()

		this.Utils = Utils
		this.type = 'body';
		this.num = Num[this.type];
		this.full = false
		this.extraConvex = false
		this.needMatrix = root.engine ==='RAPIER' || root.engine ==='HAVOK'
		//this.tmpVolume = 0

	}

	setFull( full ){
		this.num = Num[ full ? 'bodyFull':'body' ]
		this.full = full
	}

	step () {

		const AR = root.Ar;
		const N = root.ArPos[this.type];
		const list = this.list;
		let i = list.length, b, n, a;
		
		while( i-- ){

			b = list[i]

			if( b === null ) continue

			n = N + ( i * this.num );

			// update only when physics actif
			if( !b.actif ){
				// a = MathTool.nullArray( AR, n, this.num );
				//a = AR[n+0]+AR[n+1]+AR[n+2]+AR[n+3]+ AR[n+4]+AR[n+5]+AR[n+6]+AR[n+7];
				//if( a === 0 ) continue
				if( MathTool.nullArray( AR, n, this.num ) === 0 ) continue;
				else b.actif = true;
			}

		    // test is object sleep
			b.sleep = AR[n] > 0 ? false : true;

			// update default material
	        if( b.defMat ){

	        	if( b.isInstance ){
	        		b.instance.setColorAt( b.id, b.sleep ? Colors.sleep : Colors.body )
	        	} else {
	        		if ( !b.sleep && b.material.name === 'sleep' ) b.material = Mat.get('body')
			        if ( b.sleep && b.material.name === 'body' ) b.material = Mat.get('sleep')
	        	}
			    
			}

			if( b.sleep && !b.isKinematic ) continue; 

			// update position / rotation / velocity

		    if( b.isInstance ){ 
		    	if( b.speedMat ) b.instance.setColorAt(b.id, [ Math.abs(AR[n+8])*0.5, Math.abs(AR[n+9])*0.5, Math.abs(AR[n+10])*0.5] )
		    	b.instance.setTransformAt( b.id, [AR[n+1],AR[n+2],AR[n+3]], [AR[n+4],AR[n+5],AR[n+6],AR[n+7]], b.noScale ? [1,1,1] : b.size )
		    	b.position = {x:AR[n+1], y:AR[n+2], z:AR[n+3]}
		    	///b.quaternion = {x:AR[n+4], y:AR[n+5], z:AR[n+6], w:AR[n+7]}
		    	b.quaternion = {_x:AR[n+4], _y:AR[n+5], _z:AR[n+6], _w:AR[n+7]}
		    	if( this.needMatrix ) b.matrixWorld.compose( b.position, b.quaternion, {x:1, y:1, z:1}) 
		    	if( this.full ){
		    		b.velocity = {x:AR[n+8], y:AR[n+9], z:AR[n+10]}
		    		b.angular = {x:AR[n+11], y:AR[n+12], z:AR[n+13]}
		    	}
		    }
		    else {
		    	b.position.fromArray( AR, n + 1 );
		        b.quaternion.fromArray( AR, n + 4 );
		        if( this.full ){
			        b.velocity.fromArray( AR, n + 8 );
			        b.angular.fromArray( AR, n + 11 );
			    }
		        if( !b.auto ) b.updateMatrix();
		    }
		}

	}

	///

	geometry ( o = {}, b = null, material = null ) {

		//console.log("geometry is add")

		//console.log( 'geometry', o, b, material)

		let g, i, n, s = o.size, gName=''
		let t = o.type
		let noScale = false, unic = false;
		let seg = o.seg || 16;

		const noIndex = root.engine === 'OIMO' || root.engine === 'JOLT';

		//if( o.instance && t!== 'capsule'&& !o.radius) s = o.instanceSize || [1,1,1]

		if( o.instance && t=== 'compound'){ 
			t = o.shapes[0].type
			s = o.shapes[0].size
			o.translate = o.shapes[0].pos
		}

		if( t==='mesh' || t==='convex' ){
			if( o.shape ){
				if( o.shape.isMesh ) o.shape = o.shape.geometry
			} else {
				if( o.mesh && !o.v ) o.shape = o.mesh.geometry
			}	
		}

		if( o.radius ){
			if( !o.breakable ){
				if( t === 'box' ) t = 'ChamferBox';
				if( t === 'cylinder' ) t = 'ChamferCyl';
			}
		}

		if( o.geometry ){
			if( t === 'convex' ) o.shape = o.geometry;
			else t = 'direct';
		} 


	    //if( root.engine === 'PHYSX' && ( o.type==='cylinder' || o.type==='cone' ) ){
	    if( root.engine === 'PHYSX' && o.type==='cylinder' ){
			// convert geometry to convex if not in physics
	    	let geom = new CylinderGeometry( o.size[ 0 ], o.size[ 0 ], o.size[ 1 ], seg, 1 );//24
	    	if( o.isWheel ) geom.rotateZ( -PI90 );
	    	o.v = MathTool.getVertex( geom )
	    	o.type = 'convex';

	    }

	    if( ( root.engine === 'PHYSX' || root.engine === 'HAVOK' || root.engine === 'JOLT' ) && o.type==='cone' ){
	    	// convert geometry to convex if not in physics
	    	//if( !o.size[2] ) o.size[2] = 0;
	    	//console.log(o.size[2])
	    	let geom = new CylinderGeometry( 0, o.size[ 0 ], o.size[ 1 ], seg, 1 );//24

	    	//o.size[2] = o.size[0]
	    	o.v = MathTool.getVertex( geom )
	    	o.type = 'convex';

	    }

	    if( o.type==='stair' ){
	    	o.type = 'box';
	    	t = 'box';
	    }

		switch( t ){

			case 'direct':

			    g = o.geometry.clone();
			    if( o.size ) g.scale( o.size[0], o.size[1], o.size[2] );

			    unic = true
			    noScale = true

			break;

			case 'convex':

			if( o.v ){ 

				if( o.nogeo ) g = new BufferGeometry();
				else {
					let vv = [];
					i = Math.floor( o.v.length/3 );
					while( i-- ){
						n = i*3;
						vv.push( new Vector3( o.v[n], o.v[n+1], o.v[n+2] ) )
					}
					g = new ConvexGeometry( vv );
					//o.v = math.getVertex( g )
					//o.index = math.getIndex( g )
					//console.log(o.v, o.index)
				}
				unic = true;
				noScale = true;
			}

			if( o.shape ){

				g = o.shape.clone();
				if( o.size ) g.scale( o.size[0], o.size[0], o.size[0] );
				if( o.shapeScale ) g.scale( o.shapeScale[0], o.shapeScale[1], o.shapeScale[2] );
				//o.v = g.attributes.position.array;
				o.v = MathTool.getVertex( g, noIndex );
				o.index = MathTool.getIndex( g, noIndex );

				unic = true;
				noScale = true;
			}

			if(!g.boundingBox) g.computeBoundingBox();
			let bx = g.boundingBox;
		    o.boxSize = [ -bx.min.x + bx.max.x, -bx.min.y + bx.max.y, -bx.min.z + bx.max.z ];

			break;

			case 'mesh':

				g = o.shape.clone();
				if( o.size ) g.scale( o.size[0], o.size[0], o.size[0] );
				
				o.v = MathTool.getVertex( g, noIndex );
				o.index = MathTool.getIndex( g, noIndex );
				
				unic = true;
				noScale = true;
			
			break;

			case 'highSphere':

			    gName = 'highSphere_' + s[ 0 ];

			    g = Geo.get( gName )
			    if(!g){
			    	g = new SphereBox( s[ 0 ] );
					g.name = gName
			    } else {
					gName = ''
				}
			    noScale = true;
			    o.type = 'sphere';

			break;

			case 'capsule':

			    gName = 'capsule_' + s[ 0 ] +'_'+s[ 1 ] + '_' + seg; 

			    g = Geo.get( gName )
			    if(!g){
			    	//if( o.helper ) g = new CapsuleHelperGeometry( s[ 0 ], s[ 1 ] )
					//else 
					g = new Capsule( s[ 0 ], s[ 1 ], seg )
					g.name = gName
				} else {
					gName = ''
				}
				noScale = true;
			break;

			case 'ChamferBox':

			    gName = 'ChamferBox_' + s[ 0 ] +'_'+ s[ 1 ] +'_'+ s[ 2 ] + '_' + o.radius; 

			    //console.log(s, o.radius)
			    g = Geo.get( gName )
			    if(!g){
					g = new ChamferBox( s[ 0 ], s[ 1 ], s[ 2 ], o.radius );
					g.name = gName
				} else {
					gName = ''
				}
				noScale = true;
			break;

			case 'ChamferCyl':

			    gName = 'ChamferCyl_' + s[ 0 ] +'_'+ s[ 1 ] +'_'+ s[ 2 ] + '_' + o.radius + '_' + seg;



			    g = Geo.get( gName )
			    if(!g){
					g = new ChamferCyl( s[ 0 ], s[ 0 ], s[ 1 ], o.radius, seg );
					g.name = gName;
				} else {
					gName = ''
				}
				noScale = true;
			break;

			default:
			    if( !o.breakable ) g = Geo.get(t); //geo[ t ];
			    else {
			    	g = Geo.get(t).clone();
			    	g.scale( s[0], s[1], s[2] )
			    	unic = true
			    	noScale = true;
			    }
			break;

		}


		if( o.translate ) g.translate( o.translate[0], o.translate[1], o.translate[2])


		// clear untranspherable variable for phy
    	if( o.shape ) delete o.shape
    	if( o.geometry ) delete o.geometry


    	if ( g.attributes.uv === undefined || o.autoUV ){
				//console.log(o.shape)
				createUV(g, 'box', 5.0, o.pos, o.quat )
		}


    	// reuse complex geometry
    	if( gName !== '' ) Geo.set( g )

    	if( o.isWheel ){
    		g = g.clone()
    		g.rotateZ( -PI90 );
    		unic = true
    	}
    	
    	// unic geometry dispose on reset 
    	if( unic ) Geo.unic(g);

    	


    	if( b === null && material === null ){
    		g.noScale = noScale; 
    		return g
    	}

    	if( o.meshRemplace && o.debug ) material = Mat.get( 'debug' )
    	//if( o.helper ) material = Mat.get( 'hide' )

    	//if( o.instance ) return

		let m = new Mesh( g, material )

		if( o.button ) m.isButton = true

		//if( o.helper ) m.add( new LineSegments( new CapsuleHelperGeometry( s[ 0 ], s[ 1 ] ),  Mat.get( 'line' ) ))
		if( o.helper ) {

			m.add( new CapsuleHelper( s[ 0 ], s[ 1 ]+(s[ 0 ]*2), false, Mat.get( 'line' ), [0.3,0.1,0.0], [0.8,0.2,0.0], true ))
			//m.material.visible = false

		}

		if( o.localRot ) o.localQuat = MathTool.quatFromEuler(o.localRot) //math.toQuatArray( o.localRot )
		if( o.localPos ) m.position.fromArray( o.localPos )
		if( o.localQuat ) m.quaternion.fromArray( o.localQuat )

    	if( !noScale ) m.scale.fromArray( o.size )
    	//if( unic ) m.unic = true

    	// disable raycast
    	if(o.ray !== undefined){
    		if( !o.ray ) m.raycast = () => {return}
    	}

    	// add or not add
    	if( !o.meshRemplace || o.debug ) b.add( m )

	}

	add ( o = {} ) {

		//this.tmpVolume = 0

		//console.log('add', o.type )

		let i, n, name

		if( !o.instance ) name = this.setName( o );

		o.type = o.type === undefined ? 'box' : o.type;

		if( o.type === 'plane' && !o.visible ) o.visible = false;

		if( o.type === 'stair'){ 

			let v1 = new Vector3(0,0,o.size[2])
			let v2 = new Vector3(0, o.size[1]*0.5,o.size[2]*0.5)
			let angle = v1.angleTo(v2)
			let dist = v1.distanceTo(v2)
			o.rot = [angle * todeg,0,0]
			o.size[1] *= o.div || 0.2
			o.size[2] = dist*2
		
		    let p1 = new Vector3(0,-o.size[1]*0.5,0)
		    p1.applyAxisAngle({x:1, y:0, z:0},angle)
			o.pos[1] += p1.y
			o.pos[2] += p1.z
		}

		// change default center of mass 
		if( o.massCenter && root.engine !== 'PHYSX'){
			if( o.type !== 'compound' ){
				//o.localPos = o.massCenter
				o.shapes = [{ type:o.type, pos:o.massCenter, size:o.size }]
				if( o.seg ) o.shapes[0].seg = o.seg
				if( o.radius ) o.shapes[0].radius = o.radius
				delete ( o.size )
				o.type = 'compound'
			} else {
				for ( i = 0; i < o.shapes.length; i ++ ) {
					n = o.shapes[ i ]
					if( n.pos ) n.pos = Utils.vecAdd( n.pos, o.massCenter )
					else n.pos = o.massCenter
					Geo.unic(n);
				}
			}
		}

		//console.log('add', o.type, )

		// position
		o.pos = o.pos === undefined ? [ 0, 0, 0 ] : o.pos;

		// rotation is in degree or Quaternion
	    o.quat = o.quat === undefined ? [ 0, 0, 0, 1 ] : o.quat;
	    if( o.rot !== undefined ){ o.quat = MathTool.quatFromEuler(o.rot); delete o.rot; }
	    if( o.meshRot !== undefined ){ o.meshQuat = MathTool.quatFromEuler(o.meshRot); delete o.meshRot; }
	    //if( o.rot !== undefined ){ o.quat =  math.toQuatArray( o.rot ); delete o.rot; }
	    //if( o.meshRot !== undefined ){ o.meshQuat = math.toQuatArray( o.meshRot ); delete o.meshRot; }

	    //o.size = o.size == undefined ? [ 1, 1, 1 ] : math.correctSize( o.size );
	    o.size = MathTool.autoSize( o.size, o.type );
	    if( o.meshScale ) o.meshScale = MathTool.autoSize( o.meshScale )

	    let material, noMat = false;
	    //let defMat = false;

	    if( o.visible === false ) o.material = 'hide'

	    if ( o.material !== undefined ) {
	    	if ( o.material.constructor === String ) material = Mat.get( o.material )
	    	else material = o.material;
	    } else {
	    	noMat = true
	    	//defMat = this.type === 'body'
	    	material = Mat.get( this.type )
	    	if( o.instance ) material = Mat.get( 'base' )
	    }

	    if( o.unicMat ) {
	    	material = material.clone()
	    	//root.tmpMat.push( material )
	    	Mat.addToTmp( material )
	    }

	    if( o.material ) delete o.material


	    //let b = new Basic3D( o.instance )
	    let b = o.instance ? {} : new Basic3D()

	    if( o.mesh && !o.instance ){

	    	//if( o.isTerrain ) o.noClone = true
	    	if( o.mesh.type === 'terrain' ) o.noClone = true;

	    	let mm = o.noClone ? o.mesh : o.mesh.clone()

	    	mm.position.fromArray( o.meshPos || [0,0,0]);
	    	if( o.meshRot ) { o.meshQuat = MathTool.quatFromEuler(o.meshRot); delete o.meshRot; }
	    	//if( o.meshRot ) { o.meshQuat = math.toQuatArray( o.meshRot ); delete o.meshRot; }
	    	if( o.meshQuat ) mm.quaternion.fromArray( o.meshQuat )
	    	if( o.meshSize ) mm.scale.set(1,1,1).multiplyScalar(o.meshSize)
	    	if( o.meshScale ) mm.scale.fromArray( o.meshScale )
	    	
	    	if( !noMat ) mm.material = material

	    	root.tmpMesh.push(mm)

	    	o.meshRemplace = true;
	    	b.add( mm )

	    }

	    switch( o.type ){

	    	case 'null': break;

	    	case 'compound':

	    	    for ( i = 0; i < o.shapes.length; i ++ ) {

					n = o.shapes[ i ];

					n.type = n.type === undefined ? 'box' : n.type;
					//n.size = n.size === undefined ? [ 1, 1, 1 ] : math.correctSize( n.size );
					n.size = MathTool.autoSize( n.size, n.type );

					if( n.pos ) n.localPos = n.pos;

					if( n.rot !== undefined ){ n.quat = MathTool.quatFromEuler(n.rot); delete n.rot; }
					//if( n.rot !== undefined ){ n.quat = math.toQuatArray( n.rot ); delete n.rot; }
					if( n.quat ) n.localQuat = n.quat;

					n.debug = o.debug || false;
					n.meshRemplace = o.meshRemplace || false;

					if( !o.instance ) this.geometry( n, b, material )
				}

	    	break;
	    	default:

			    if( !o.instance ) this.geometry( o, b, material );

			break;

	    }



	    
	    b.type = this.type
	    b.size = o.size
		b.shapetype = o.type
		b.isKinematic = o.kinematic || false;
		b.link = 0;

		// for buttton only
		if( o.button ) b.isButton = true

	    // enable or disable raycast
	    b.isRay = true//b.type === 'body' || b.isButton ? true : false
	    if( o.ray !== undefined ) b.isRay = o.ray; 
	    if( !o.instance ) b.setRaycast()
	    

		if( !noMat ) b.material = material
		b.defMat = false;
		
		if( b.material && noMat ) b.defMat = b.material.name === 'body'


		//  for instancing
		if( o.instance ){ 

			b.isInstance = true;
			b.instance = root.instanceMesh[ o.instance ] || this.addInstance( o, material );
			b.instance.isRay = b.isRay;

			b.defMat = b.instance.material.name === 'base'
			
			b.id = b.instance.count;
			b.mass = o.mass || 0
			
			b.name = b.instance.name + b.id;
			//if( o.name ) b.name = o.name
			o.name = b.name;
			b.noScale = b.instance.noScale//false//o.type!=='box' || o.type!=='ChamferBox' || o.type!=='sphere';
			if(o.sizeByInstance) b.noScale = false
			//if(o.type === 'sphere') b.noScale = false
		    //if( o.type === 'capsule' ) b.noScale = true
		    //if( o.type === 'box' ) b.noScale = true
			//if(o.radius) b.noScale = true

			let color = o.color;
			if( b.defMat ) color = o.sleep ? Colors.sleep : Colors.body;

			b.instance.add( o.pos, o.quat, b.noScale ? [1,1,1] : b.size, color );

			b.position = {x:o.pos[0], y:o.pos[1], z:o.pos[2]}
			b.quaternion = {_x:o.quat[0], _y:o.quat[1], _z:o.quat[2], _w:o.quat[3]}
		    b.velocity = {x:0, y:0, z:0}
		    b.angular = {x:0, y:0, z:0}
		    b.link = 0;
		    if( this.needMatrix ) b.matrixWorld = new Matrix4()



			// for convex
			if(b.instance.v) o.v = b.instance.v
			if(b.instance.index) o.index = b.instance.index;
		    o.type = b.instance.type;

		    //console.log(o.v)

			/*if( this.extraConvex && ( o.type==='cylinder' || o.type==='cone') ){
		    	o.v = b.instance.v;
		    	o.type = 'convex';
		    }*/


			//console.log( b )

		} else {

			b.name = name;

			if( o.renderOrder ) b.renderOrder = o.renderOrder
			if( o.visible === undefined ) o.visible = true
			if( o.shadow === undefined ) o.shadow = o.visible

			b.visible = o.visible !== undefined ? o.visible : true
		    b.receiveShadow = o.shadow
		    b.castShadow = o.shadow

		    // apply option
			this.set( o, b )

		}

	    if( o.instance ) delete o.instance
	    if( o.mesh ) delete o.mesh


    	if( o.breakable ){

    		root.motor.addBreaker()
			let child = b.children[0];
			b.remove(child);
			b = child;
			b.name = name;
			b.type = this.type
			b.density = o.density;
			b.breakable = true;
			b.breakOption = o.breakOption !== undefined ? o.breakOption : [ 250, 1, 2, 1 ];
			//b.userData.mass = o.mass;
		}

		// for skeleton mesh

		/*if( o.bone ){

			b.userData.decal = o.decal;
            b.userData.decalinv = o.decalinv;
            b.userData.bone = o.bone;
		    

		    delete o.bone
		    delete o.decal
		    delete o.decalinv
		}*/

		//o.volume = this.tmpVolume


		



		// add to world
		this.addToWorld( b, o.id )

		if( o.onlyMakeMesh ) return b

		if(o.phySize) o.size = o.phySize
		if(o.phyPos) o.pos = o.phyPos

		if(o.parent) delete o.parent

		// add to physic worker 
		root.post( { m:'add', o:o } )

		//console.log(b)

		return b

	}

	set ( o = {}, b = null ) {

		if( b === null ) b = this.byName( o.name )
		if( b === null ) return

		/*if(b.isInstance){

			b.instance.setTransformAt( b.id, o.pos, o.quat, b.noScale ? [1,1,1] : b.size )
		    b.position = {x:o.pos[0], y:o.pos[1], z:o.pos[2]}

		}else{*/
			if( o.pos ) b.position.fromArray( o.pos )
		    if( o.quat ) b.quaternion.fromArray( o.quat )

		    b.auto = o.auto || false

		    if( !b.auto ) {
		    	b.matrixAutoUpdate = false
			    b.updateMatrix()
			} else {
				b.matrixAutoUpdate = true
			}
		//}

		

	}

	addInstance ( o, material ) {

		//console.log(o)
		if( o.sizeByInstance ) o.size = [1,1,1]
		let g = this.geometry( o )

	//console.log(g)

		if( o.mesh ) {
			g = o.mesh.isObject3D ? o.mesh.geometry.clone() : o.mesh.clone()
			if( o.meshScale ) g.scale( o.meshScale[0], o.meshScale[1], o.meshScale[2] )
			g.noScale = true
		}/* else {
			g = this.geometry( o )
		}*/

		let bb = new Instance( g, material, 0 )

		bb.type = o.type;
		bb.noScale = g.noScale

		//console.log(o)
		if( bb.type === 'convex' ) bb.v = o.v;
		if( o.index ) bb.index = o.index;
		

		//if( bb.type==='convex' ) bb.v = MathTool.getVertex( bb.geometry )

    	//bb.matrixAutoUpdate = false
    	//bb.instanceMatrix.setUsage( DynamicDrawUsage )
    	bb.receiveShadow = o.shadow !== undefined ? o.shadow : true;
    	bb.castShadow = o.shadow !== undefined ? o.shadow : true;

    	bb.name = o.instance;
		root.scene.add( bb )
		root.instanceMesh[ o.instance ] = bb


		//console.log(bb.name+" is add")

    	return bb

	}

}