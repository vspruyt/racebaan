import * as THREE from 'three'

export function createRaceCar({
  boostExhaustLocalX,
  boostExhaustLocalY,
  boostExhaustLocalZ,
  carScale,
}) {
  let steeringWheelGroup
  let frontLeftWheelGroup
  let frontRightWheelGroup
  let rearLeftWheelGroup
  let rearRightWheelGroup

  function createWheel() {
    const wheel = new THREE.Group()
    wheel.rotation.order = 'YXZ'

    const tire = new THREE.Mesh(
      new THREE.CylinderGeometry(0.34, 0.34, 0.28, 24),
      new THREE.MeshStandardMaterial({
        color: 0x05070b,
        roughness: 0.9,
        metalness: 0.05,
      }),
    )
    tire.rotation.z = Math.PI / 2
    wheel.add(tire)

    const rim = new THREE.Mesh(
      new THREE.CylinderGeometry(0.18, 0.18, 0.3, 18),
      new THREE.MeshStandardMaterial({
        color: 0xdbeafe,
        roughness: 0.25,
        metalness: 0.95,
      }),
    )
    rim.rotation.z = Math.PI / 2
    wheel.add(rim)

    return wheel
  }

  const car = new THREE.Group()
  car.rotation.order = 'YXZ'

  const bodyMaterial = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    metalness: 0.6,
    roughness: 0.28,
  })

  const detailMaterial = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.8,
    roughness: 0.2,
  })

  const darkMaterial = new THREE.MeshStandardMaterial({
    color: 0x1f2937,
    metalness: 0.35,
    roughness: 0.36,
  })

  const chassis = new THREE.Mesh(
    new THREE.BoxGeometry(1.45, 0.32, 3.2),
    bodyMaterial,
  )
  chassis.position.y = 0.2
  car.add(chassis)

  const nose = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22, 0.34, 1.1, 20),
    bodyMaterial,
  )
  nose.rotation.x = Math.PI / 2
  nose.position.set(0, 0.22, 1.95)
  car.add(nose)

  const cockpitFloor = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.12, 0.96),
    darkMaterial,
  )
  cockpitFloor.position.set(0, 0.36, 0.14)
  car.add(cockpitFloor)

  const cockpitSeat = new THREE.Mesh(
    new THREE.BoxGeometry(0.42, 0.2, 0.36),
    darkMaterial,
  )
  cockpitSeat.position.set(0, 0.48, -0.08)
  car.add(cockpitSeat)

  const cockpitLeftWall = new THREE.Mesh(
    new THREE.BoxGeometry(0.08, 0.34, 0.86),
    darkMaterial,
  )
  cockpitLeftWall.position.set(0.37, 0.5, 0.16)
  car.add(cockpitLeftWall)

  const cockpitRightWall = cockpitLeftWall.clone()
  cockpitRightWall.position.x = -0.37
  car.add(cockpitRightWall)

  const cockpitDash = new THREE.Mesh(
    new THREE.BoxGeometry(0.58, 0.22, 0.14),
    darkMaterial,
  )
  cockpitDash.position.set(0, 0.54, 0.48)
  car.add(cockpitDash)

  const windshieldFrame = new THREE.Mesh(
    new THREE.BoxGeometry(0.66, 0.08, 0.08),
    detailMaterial,
  )
  windshieldFrame.position.set(0, 0.68, 0.56)
  car.add(windshieldFrame)

  const windshield = new THREE.Mesh(
    new THREE.PlaneGeometry(0.56, 0.2),
    new THREE.MeshStandardMaterial({
      color: 0xdbeafe,
      metalness: 0,
      roughness: 0.08,
      transparent: true,
      opacity: 0.22,
      side: THREE.DoubleSide,
    }),
  )
  windshield.position.set(0, 0.6, 0.52)
  windshield.rotation.x = -0.32
  car.add(windshield)

  const rollHoop = new THREE.Mesh(
    new THREE.BoxGeometry(0.52, 0.42, 0.08),
    detailMaterial,
  )
  rollHoop.position.set(0, 0.72, -0.06)
  car.add(rollHoop)

  const steeringColumn = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.05, 0.38, 12),
    darkMaterial,
  )
  steeringColumn.position.set(0, 0.5, 0.38)
  steeringColumn.rotation.x = Math.PI * 0.34
  car.add(steeringColumn)

  const steeringWheel = new THREE.Group()
  steeringWheel.position.set(0, 0.52, 0.44)
  steeringWheel.rotation.x = -0.36
  car.add(steeringWheel)
  steeringWheelGroup = steeringWheel

  const steeringWheelRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.18, 0.022, 12, 28),
    detailMaterial,
  )
  steeringWheel.add(steeringWheelRim)

  const steeringWheelHub = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12),
    detailMaterial,
  )
  steeringWheelHub.rotation.x = Math.PI / 2
  steeringWheel.add(steeringWheelHub)

  const steeringWheelSpokeTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.026, 0.12, 0.02),
    detailMaterial,
  )
  steeringWheelSpokeTop.position.set(0, 0.06, 0)
  steeringWheel.add(steeringWheelSpokeTop)

  const steeringWheelSpokeLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.11, 0.026, 0.02),
    detailMaterial,
  )
  steeringWheelSpokeLeft.position.set(-0.055, -0.03, 0)
  steeringWheelSpokeLeft.rotation.z = -0.5
  steeringWheel.add(steeringWheelSpokeLeft)

  const steeringWheelSpokeRight = steeringWheelSpokeLeft.clone()
  steeringWheelSpokeRight.position.x = 0.055
  steeringWheelSpokeRight.rotation.z = 0.5
  steeringWheel.add(steeringWheelSpokeRight)

  const accentStripe = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.02, 3),
    detailMaterial,
  )
  accentStripe.position.set(0, 0.37, 0.08)
  car.add(accentStripe)

  const sidePodLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.38, 0.18, 1.3),
    bodyMaterial,
  )
  sidePodLeft.position.set(0.62, 0.2, 0.1)
  car.add(sidePodLeft)

  const sidePodRight = sidePodLeft.clone()
  sidePodRight.position.x = -0.62
  car.add(sidePodRight)

  const engineCover = new THREE.Mesh(
    new THREE.BoxGeometry(0.56, 0.18, 0.66),
    bodyMaterial,
  )
  engineCover.position.set(0, 0.4, -1.08)
  car.add(engineCover)

  const exhaustPipe = new THREE.Mesh(
    new THREE.CylinderGeometry(0.11, 0.13, 0.34, 18),
    detailMaterial,
  )
  exhaustPipe.rotation.x = Math.PI / 2
  exhaustPipe.position.set(
    boostExhaustLocalX,
    boostExhaustLocalY,
    boostExhaustLocalZ,
  )
  car.add(exhaustPipe)

  const exhaustInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.085, 0.28, 18),
    darkMaterial,
  )
  exhaustInner.rotation.x = Math.PI / 2
  exhaustInner.position.set(
    boostExhaustLocalX,
    boostExhaustLocalY,
    boostExhaustLocalZ - 0.04,
  )
  car.add(exhaustInner)

  const frontLeftWheel = createWheel()
  frontLeftWheel.position.set(0.86, 0.02, 1.08)
  car.add(frontLeftWheel)
  frontLeftWheelGroup = frontLeftWheel

  const frontRightWheel = createWheel()
  frontRightWheel.position.set(-0.86, 0.02, 1.08)
  car.add(frontRightWheel)
  frontRightWheelGroup = frontRightWheel

  const rearLeftWheel = createWheel()
  rearLeftWheel.position.set(0.86, 0.02, -1.08)
  car.add(rearLeftWheel)
  rearLeftWheelGroup = rearLeftWheel

  const rearRightWheel = createWheel()
  rearRightWheel.position.set(-0.86, 0.02, -1.08)
  car.add(rearRightWheel)
  rearRightWheelGroup = rearRightWheel

  const headlightLeft = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.08, 0.12),
    new THREE.MeshStandardMaterial({
      color: 0xfef3c7,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.5,
    }),
  )
  headlightLeft.position.set(0.36, 0.2, 2.42)
  car.add(headlightLeft)

  const headlightRight = headlightLeft.clone()
  headlightRight.position.x = -0.36
  car.add(headlightRight)

  car.scale.setScalar(carScale)

  return {
    car,
    steeringWheelGroup,
    frontLeftWheelGroup,
    frontRightWheelGroup,
    rearLeftWheelGroup,
    rearRightWheelGroup,
  }
}

export function addDayEnvironment({
  scene,
  createTracksidePoint,
  treeClearance,
}) {
  const skyDome = new THREE.Mesh(
    new THREE.SphereGeometry(90, 32, 16),
    new THREE.MeshBasicMaterial({
      color: 0xbfe7ff,
      side: THREE.BackSide,
    }),
  )
  scene.add(skyDome)

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(2.4, 24, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff1a8 }),
  )
  sun.position.set(-30, 32, -34)
  scene.add(sun)

  const sunHalo = new THREE.Mesh(
    new THREE.SphereGeometry(3.6, 24, 24),
    new THREE.MeshBasicMaterial({
      color: 0xfff8d6,
      transparent: true,
      opacity: 0.25,
    }),
  )
  sunHalo.position.copy(sun.position)
  scene.add(sunHalo)

  for (const placement of createTracksideTreeLayout()) {
    const treePoint = createTracksidePoint(placement, treeClearance)
    const tree = createTree(
      placement.scale,
      treePoint.x > 0 ? 0x3a8b54 : 0x2f7a4b,
    )
    tree.position.set(treePoint.x, -1.2, treePoint.z)
    scene.add(tree)
  }
}

function createTracksideTreeLayout() {
  return [
    { sampleIndex: 22, side: -1, offset: 4.8, tangentOffset: -1.4, scale: 1.08 },
    { sampleIndex: 74, side: 1, offset: 5.0, tangentOffset: 1.8, scale: 0.96 },
    { sampleIndex: 128, side: -1, offset: 4.6, tangentOffset: -1.1, scale: 1.1 },
    { sampleIndex: 184, side: 1, offset: 5.2, tangentOffset: 1.0, scale: 0.92 },
    { sampleIndex: 238, side: -1, offset: 4.9, tangentOffset: -1.6, scale: 1.04 },
    { sampleIndex: 292, side: 1, offset: 5.3, tangentOffset: 0.7, scale: 0.9 },
    { sampleIndex: 346, side: -1, offset: 4.7, tangentOffset: 1.8, scale: 1.12 },
    { sampleIndex: 402, side: 1, offset: 5.1, tangentOffset: -0.9, scale: 0.94 },
    { sampleIndex: 456, side: -1, offset: 5.0, tangentOffset: 1.2, scale: 1.05 },
    { sampleIndex: 510, side: 1, offset: 4.8, tangentOffset: -1.5, scale: 0.98 },
    { sampleIndex: 566, side: -1, offset: 5.2, tangentOffset: 0.8, scale: 1.09 },
    { sampleIndex: 620, side: 1, offset: 4.9, tangentOffset: -1.7, scale: 0.9 },
    { sampleIndex: 676, side: -1, offset: 5.3, tangentOffset: 1.1, scale: 1.02 },
    { sampleIndex: 732, side: 1, offset: 4.8, tangentOffset: -0.8, scale: 1.14 },
    { sampleIndex: 788, side: -1, offset: 5.1, tangentOffset: 1.6, scale: 0.95 },
    { sampleIndex: 846, side: 1, offset: 5.0, tangentOffset: -1.2, scale: 1.06 },
  ]
}

function createTree(scale = 1, crownColor = 0x2f855a) {
  const tree = new THREE.Group()

  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.22, 1.6, 10),
    new THREE.MeshStandardMaterial({
      color: 0x8b5a2b,
      roughness: 0.95,
      metalness: 0,
    }),
  )
  trunk.position.y = 0.8
  tree.add(trunk)

  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(0.9, 2.4, 12),
    new THREE.MeshStandardMaterial({
      color: crownColor,
      roughness: 0.95,
      metalness: 0,
    }),
  )
  crown.position.y = 2.35
  tree.add(crown)

  const crownLower = new THREE.Mesh(
    new THREE.ConeGeometry(1.15, 1.8, 12),
    new THREE.MeshStandardMaterial({
      color: crownColor,
      roughness: 0.95,
      metalness: 0,
    }),
  )
  crownLower.position.y = 1.65
  tree.add(crownLower)

  tree.scale.setScalar(scale)
  return tree
}
