import { LevelConfig } from './types';

export const DEFAULT_LEVELS: LevelConfig[] = [
  {
    id: 'tutorial_skyway',
    name: 'Delta Skyway',
    description: 'Learn the fundamentals of momentum, wall-running, and sliding on these floating sky platforms.',
    theme: 'sky_islands',
    blocks: [
      // Spawn/Start Pad
      { id: 'b0', type: 'start', x: 0, y: 0, z: 0, w: 6, h: 1, d: 6 },
      
      // Basic jump concrete block
      { id: 'b1', type: 'normal', x: 0, y: 0, z: -10, w: 4, h: 1, d: 4 },
      
      // Further jump
      { id: 'b2', type: 'normal', x: 0, y: 0.5, z: -20, w: 4, h: 1, d: 4 },
      
      // Jump pad to launch player up
      { id: 'b3', type: 'jump', x: 0, y: 1.0, z: -30, w: 3, h: 0.8, d: 3 },
      
      // High platform after jump pad
      { id: 'b4', type: 'normal', x: 0, y: 8, z: -39, w: 6, h: 1, d: 6 },

      // Checkpoint half-way
      { id: 'b5', type: 'checkpoint', x: 0, y: 8.0, z: -50, w: 4, h: 1.0, d: 4 },

      // Obstacle overhead prompting user to slide
      { id: 'b6_side1', type: 'normal', x: -3, y: 11, z: -61, w: 2, h: 4, d: 8 },
      { id: 'b6_side2', type: 'normal', x: 3, y: 11, z: -61, w: 2, h: 4, d: 8 },
      { id: 'b6_roof', type: 'normal', x: 0, y: 11.8, z: -61, w: 4, h: 2, d: 8 }, // Gap is y=[8.5, 10.8], perfect for crouch/slide!
      
      // Landing area after slide
      { id: 'b7', type: 'normal', x: 0, y: 8, z: -74, w: 5, h: 1, d: 6 },

      // Wall to run along (Right wall)
      { id: 'b8', type: 'wallrun', x: 5, y: 11, z: -91, w: 1, h: 6, d: 16 },
      // Hazards below the wallrun path
      { id: 'b9_lava', type: 'hazard', x: 0, y: 2, z: -91, w: 16, h: 1, d: 24 },

      // Receiving station after wallrun
      { id: 'b10', type: 'normal', x: 0, y: 8, z: -110, w: 6, h: 1, d: 6 },

      // Finish pad!
      { id: 'b11', type: 'end', x: 0, y: 9, z: -123, w: 6, h: 1, d: 6 }
    ]
  },
  {
    id: 'neon_velocity',
    name: 'Neon Velocity Grid',
    description: 'A dark world of retro glowing vectors. Execute precision speed boosts, leap wide gaps, and discover high-skill shortcut jumps.',
    theme: 'neon_grid',
    blocks: [
      { id: 'n0', type: 'start', x: 0, y: 0, z: 0, w: 8, h: 1, d: 8 },
      
      // Speed booster
      { id: 'n1', type: 'speed', x: 0, y: 0, z: -15, w: 4, h: 1, d: 10 },
      
      // Moderate gap landing on a narrow glass block with speed boost momentum (Ends Z -20 to Z -28)
      { id: 'n2', type: 'glass', x: 0, y: 0, z: -28, w: 4, h: 1, d: 4 },
      
      // Wallrun wall (Left)
      { id: 'n3', type: 'wallrun', x: -6, y: 1.5, z: -44, w: 1, h: 8, d: 18 },
      
      // Sibling Wallrun on right for zig-zag wall running (Smooth transition from left wallrun jump)
      { id: 'n4', type: 'wallrun', x: 6, y: 3.5, z: -56, w: 1, h: 8, d: 18 },

      // Mid checkpoint on a high glowing pillar, easily reached by jumping off wallrun right
      { id: 'n5', type: 'checkpoint', x: 0, y: 4, z: -74, w: 4, h: 1, d: 4 },

      // Hazard field below
      { id: 'n6_hazard', type: 'hazard', x: 0, y: -10, z: -100, w: 100, h: 1, d: 300 },

      // Safe route: small blocks
      { id: 'n7_safe1', type: 'normal', x: -5, y: 4, z: -86, w: 3, h: 1, d: 3 },
      { id: 'n7_safe2', type: 'normal', x: -5, y: 4, z: -98, w: 3, h: 1, d: 3 },

      // Risky shortcut: huge jump booster to high wall
      { id: 'n8_shortcut_launch', type: 'jump', x: 5, y: 4, z: -85, w: 2, h: 1, d: 2 },
      { id: 'n8_shortcut_land', type: 'normal', x: 6, y: 10, z: -105, w: 4, h: 1, d: 4 },

      // Re-convergence platform
      { id: 'n9', type: 'checkpoint', x: 0, y: 8, z: -112, w: 6, h: 1, d: 6 },

      // Speed boost to the finish line
      { id: 'n10', type: 'speed', x: 0, y: 7.0, z: -126, w: 4, h: 1, d: 10 },
      
      // Floating finish
      { id: 'n11', type: 'end', x: 0, y: 7, z: -145, w: 6, h: 1, d: 6 }
    ]
  },
  {
    id: 'rust_ascent',
    name: 'Industrial Rust Ascent',
    description: 'Scale complex skeletal ruins surrounded by lava. Heavy emphasis on climbing, sliding, and vertical momentum control.',
    theme: 'industrial_rust',
    blocks: [
      { id: 'r0', type: 'start', x: 0, y: 0, z: 0, w: 6, h: 1, d: 6 },
      
      // Giant lava lake at the bottom
      { id: 'r_lava', type: 'hazard', x: 0, y: -8, z: -60, w: 120, h: 1, d: 200 },

      // Climbing lattice - easily accessible
      { id: 'r1_climb', type: 'climb', x: 0, y: 2, z: -8, w: 4, h: 8, d: 1 },

      // Landing from climb
      { id: 'r2', type: 'normal', x: 0, y: 6, z: -14, w: 4, h: 1, d: 4 },

      // Left Wallrun
      { id: 'r3_wall', type: 'wallrun', x: -5, y: 8, z: -28, w: 1, h: 6, d: 14 },

      // High platform
      { id: 'r4', type: 'normal', x: 0, y: 8, z: -42, w: 4, h: 1, d: 4 },

      // Vertical Climbing cage
      { id: 'r5_climb_vert', type: 'climb', x: 0, y: 10, z: -50, w: 2, h: 10, d: 2 },

      // Checkpoint high up
      { id: 'r6', type: 'checkpoint', x: 0, y: 15.5, z: -53, w: 4, h: 1, d: 4 },

      // Moving-speed conveyor facing sideways!
      { id: 'r7_booster', type: 'speed', x: 0, y: 14.5, z: -61, w: 8, h: 1, d: 4 },

      // Slide and jump gap under low hanger
      { id: 'r8_roof', type: 'normal', x: 0, y: 18, z: -74, w: 4, h: 2, d: 6 },
      { id: 'r8_floor', type: 'normal', x: 0, y: 14.5, z: -74, w: 4, h: 1, d: 8 },

      // Steep drop to finish platform far below
      { id: 'r9_end', type: 'end', x: 0, y: 5, z: -92, w: 8, h: 1, d: 8 }
    ]
  },
  {
    id: 'sunset_ridge',
    name: 'Sunset Ridge Trial',
    description: 'A grueling high-altitude run through warm mountain canyons. Execute precise parkour across collapsible glass bridges, chained wall-runs, and heavy sliding drops.',
    theme: 'mountain_sunset',
    blocks: [
      { id: 's0', type: 'start', x: 0, y: 0, z: 0, w: 6, h: 1, d: 6 },
      
      // Cascading gap jumps starting off
      { id: 's1', type: 'normal', x: 0, y: 1, z: -14, w: 4, h: 1, d: 4 },
      { id: 's2', type: 'glass', x: -4, y: 3, z: -25, w: 2, h: 1, d: 2 },
      { id: 's3', type: 'glass', x: 4, y: 5, z: -36, w: 2, h: 1, d: 2 },
      { id: 's4', type: 'normal', x: 0, y: 7, z: -48, w: 4, h: 1, d: 4 },
      
      // High altitude leap pad
      { id: 's5_jump', type: 'jump', x: 0, y: 7, z: -57, w: 3, h: 0.8, d: 3 },
      
      // High wallrun from the jump pad
      { id: 's6_wall1', type: 'wallrun', x: -5, y: 15, z: -76, w: 1, h: 8, d: 22 },
      
      // Mid-way checkpoint landing ledge
      { id: 's7', type: 'checkpoint', x: 4, y: 13, z: -94, w: 4, h: 1, d: 4 },
      
      // Canyon hazards down below
      { id: 's_hazard', type: 'hazard', x: 0, y: -2, z: -150, w: 150, h: 1, d: 350 },
      
      // Zig-zag wall running chains
      { id: 's8_wall2', type: 'wallrun', x: 6, y: 15, z: -114, w: 1, h: 8, d: 24 },
      { id: 's9_wall3', type: 'wallrun', x: -6, y: 13, z: -138, w: 1, h: 8, d: 24 },
      
      // Sliding under overhang obstacle with speed boost momentum
      { id: 's10_slide_entry', type: 'speed', x: 0, y: 9, z: -154, w: 4, h: 1, d: 12 },
      { id: 's11_roof', type: 'normal', x: 0, y: 12.8, z: -162, w: 4, h: 2, d: 16 },
      { id: 's11_floor', type: 'normal', x: 0, y: 9, z: -166.5, w: 4, h: 1, d: 13 },
      
      // Vertical ascent scaffolding tower
      { id: 's12_climb', type: 'climb', x: 0, y: 14, z: -183, w: 4, h: 14, d: 2 },
      { id: 's13', type: 'checkpoint', x: 0, y: 21, z: -186, w: 4, h: 1, d: 4 },
      
      // High-precision descending glass stairs
      { id: 's14_g1', type: 'glass', x: -3, y: 19, z: -195, w: 2, h: 1, d: 2 },
      { id: 's14_g2', type: 'glass', x: 3, y: 17, z: -206, w: 2, h: 1, d: 2 },
      { id: 's14_g3', type: 'glass', x: -3, y: 15, z: -217, w: 2, h: 1, d: 2 },
      
      // Floating end-dock
      { id: 's15_end', type: 'end', x: 0, y: 13, z: -228, w: 6, h: 1, d: 6 }
    ]
  },
  {
    id: 'monochrome_void',
    name: 'Monochrome Void',
    description: 'An extreme test of parkour mechanics in an abstract, surgical space. Featuring hyper-fast speed loops, multi-tiered climbing, and high-precision jump pad rebounds.',
    theme: 'abstract_white',
    blocks: [
      { id: 'v0', type: 'start', x: 0, y: 0, z: 0, w: 8, h: 1, d: 8 },
      
      // Vast hazard floor below
      { id: 'v_hazard', type: 'hazard', x: 0, y: -15, z: -170, w: 200, h: 1, d: 450 },
      
      // Massive momentum speed runway
      { id: 'v1_speed', type: 'speed', x: 0, y: 0, z: -18, w: 4, h: 1, d: 18 },
      
      // Single narrow platform to land on with huge momentum
      { id: 'v2_normal', type: 'normal', x: 0, y: -2, z: -48, w: 3, h: 1, d: 3 },
      
      // Vertical climb scaffold
      { id: 'v3_climb', type: 'climb', x: -5, y: -1, z: -58, w: 1, h: 12, d: 2 },
      { id: 'v4', type: 'normal', x: -5, y: 5, z: -64, w: 3, h: 1, d: 3 },
      
      // Smooth wallrun transition
      { id: 'v5_wall1', type: 'wallrun', x: -10, y: 7, z: -86, w: 1, h: 8, d: 26 },
      
      // Springpad mid-way off the wallrun
      { id: 'v6_jump', type: 'jump', x: -4, y: 4, z: -102, w: 3, h: 0.8, d: 3 },
      
      // Receiving checkpoint high up
      { id: 'v7_checkpoint', type: 'checkpoint', x: 5, y: 13, z: -112, w: 4, h: 1, d: 4 },
      
      // Disappearing glass stepping stones
      { id: 'v8_g1', type: 'glass', x: 5, y: 12, z: -126, w: 2, h: 1, d: 2 },
      { id: 'v9_g2', type: 'glass', x: 1, y: 11, z: -138, w: 2, h: 1, d: 2 },
      { id: 'v10_g3', type: 'glass', x: -3, y: 10, z: -150, w: 2, h: 1, d: 2 },
      
      // Air speed booster
      { id: 'v11_speed', type: 'speed', x: -3, y: 9, z: -164, w: 4, h: 1, d: 10 },
      
      // Jump block helper to make the leap to the ladder
      { id: 'v11_mid_jump', type: 'jump', x: -3, y: 11, z: -181, w: 3, h: 0.8, d: 3 },
      
      // Massively far climbing tower leap
      { id: 'v12_climb', type: 'climb', x: -3, y: 15, z: -198, w: 6, h: 14, d: 2 },
      { id: 'v13_checkpoint', type: 'checkpoint', x: -3, y: 22, z: -201, w: 4, h: 1, d: 4 },
      
      // Chained high altitude wallruns
      { id: 'v14_wall2', type: 'wallrun', x: -9, y: 22, z: -220, w: 1, h: 8, d: 20 },
      { id: 'v15_wall3', type: 'wallrun', x: 3, y: 21, z: -242, w: 1, h: 8, d: 20 },
      
      // Fast floating speed boost
      { id: 'v16_speed', type: 'speed', x: -3, y: 17, z: -260, w: 4, h: 1, d: 8 },
      
      // Last precision landing
      { id: 'v17_glass', type: 'glass', x: -3, y: 15, z: -278, w: 2, h: 1, d: 2 },
      
      // Giant leap to the End Reactor Node
      { id: 'v18_end', type: 'end', x: -3, y: 13, z: -292, w: 6, h: 1, d: 6 }
    ]
  },
  {
    id: 'lava_patchwork',
    name: 'Lava Patchwork Grid',
    description: 'A massive flat matrix of tiles suspended in a glowing void. Navigate a maze of speed pads, jump rebounds, and volatile glass right next to scorching lava blocks.',
    theme: 'industrial_rust',
    blocks: [
      // Spawn Pad
      { id: 'lp0_start', type: 'start', x: 0, y: 0, z: 0, w: 6, h: 1, d: 6 },

      // Row 1 (z = -5)
      { id: 'lp1_r1_c1', type: 'hazard', x: -8, y: 0, z: -5, w: 4, h: 1, d: 4 },
      { id: 'lp1_r1_c2', type: 'normal', x: -4, y: 0, z: -5, w: 4, h: 1, d: 4 },
      { id: 'lp1_r1_c3', type: 'normal', x: 0, y: 0, z: -5, w: 4, h: 1, d: 4 },
      { id: 'lp1_r1_c4', type: 'normal', x: 4, y: 0, z: -5, w: 4, h: 1, d: 4 },
      { id: 'lp1_r1_c5', type: 'hazard', x: 8, y: 0, z: -5, w: 4, h: 1, d: 4 },

      // Row 2 (z = -9)
      { id: 'lp2_r2_c1', type: 'hazard', x: -8, y: 0, z: -9, w: 4, h: 1, d: 4 },
      { id: 'lp2_r2_c2', type: 'speed', x: -4, y: 0, z: -9, w: 4, h: 1, d: 4 },
      { id: 'lp2_r2_c3', type: 'hazard', x: 0, y: 0, z: -9, w: 4, h: 1, d: 4 },
      { id: 'lp2_r2_c4', type: 'speed', x: 4, y: 0, z: -9, w: 4, h: 1, d: 4 },
      { id: 'lp2_r2_c5', type: 'hazard', x: 8, y: 0, z: -9, w: 4, h: 1, d: 4 },

      // Row 3 (z = -13)
      { id: 'lp3_r3_c1', type: 'normal', x: -8, y: 0, z: -13, w: 4, h: 1, d: 4 },
      { id: 'lp3_r3_c2', type: 'normal', x: -4, y: 0, z: -13, w: 4, h: 1, d: 4 },
      { id: 'lp3_r3_c3', type: 'glass', x: 0, y: 0, z: -13, w: 4, h: 1, d: 4 },
      { id: 'lp3_r3_c4', type: 'normal', x: 4, y: 0, z: -13, w: 4, h: 1, d: 4 },
      { id: 'lp3_r3_c5', type: 'normal', x: 8, y: 0, z: -13, w: 4, h: 1, d: 4 },

      // Row 4 (z = -17)
      { id: 'lp4_r4_c1', type: 'hazard', x: -8, y: 0, z: -17, w: 4, h: 1, d: 4 },
      { id: 'lp4_r4_c2', type: 'hazard', x: -4, y: 0, z: -17, w: 4, h: 1, d: 4 },
      { id: 'lp4_r4_c3', type: 'jump', x: 0, y: 0, z: -17, w: 4, h: 0.8, d: 4 },
      { id: 'lp4_r4_c4', type: 'hazard', x: 4, y: 0, z: -17, w: 4, h: 1, d: 4 },
      { id: 'lp4_r4_c5', type: 'hazard', x: 8, y: 0, z: -17, w: 4, h: 1, d: 4 },

      // Row 5 (z = -21)
      { id: 'lp5_r5_c1', type: 'glass', x: -8, y: 0, z: -21, w: 4, h: 1, d: 4 },
      { id: 'lp5_r5_c2', type: 'glass', x: -4, y: 0, z: -21, w: 4, h: 1, d: 4 },
      { id: 'lp5_r5_c3', type: 'hazard', x: 0, y: 0, z: -21, w: 4, h: 1, d: 4 },
      { id: 'lp5_r5_c4', type: 'glass', x: 4, y: 0, z: -21, w: 4, h: 1, d: 4 },
      { id: 'lp5_r5_c5', type: 'glass', x: 8, y: 0, z: -21, w: 4, h: 1, d: 4 },

      // Row 6 (z = -25)
      { id: 'lp6_r6_c1', type: 'normal', x: -8, y: 0, z: -25, w: 4, h: 1, d: 4 },
      { id: 'lp6_r6_c2', type: 'hazard', x: -4, y: 0, z: -25, w: 4, h: 1, d: 4 },
      { id: 'lp6_r6_c3', type: 'hazard', x: 0, y: 0, z: -25, w: 4, h: 1, d: 4 },
      { id: 'lp6_r6_c4', type: 'hazard', x: 4, y: 0, z: -25, w: 4, h: 1, d: 4 },
      { id: 'lp6_r6_c5', type: 'normal', x: 8, y: 0, z: -25, w: 4, h: 1, d: 4 },

      // Row 7 (z = -29)
      { id: 'lp7_r7_c1', type: 'checkpoint', x: -8, y: 0, z: -29, w: 4, h: 1, d: 4 },
      { id: 'lp7_r7_c2', type: 'hazard', x: -4, y: 0, z: -29, w: 4, h: 1, d: 4 },
      { id: 'lp7_r7_c3', type: 'speed', x: 0, y: 0, z: -29, w: 4, h: 1, d: 4 },
      { id: 'lp7_r7_c4', type: 'hazard', x: 4, y: 0, z: -29, w: 4, h: 1, d: 4 },
      { id: 'lp7_r7_c5', type: 'checkpoint', x: 8, y: 0, z: -29, w: 4, h: 1, d: 4 },

      // Row 8 (z = -33)
      { id: 'lp8_r8_c1', type: 'speed', x: -8, y: 0, z: -33, w: 4, h: 1, d: 4 },
      { id: 'lp8_r8_c2', type: 'hazard', x: -4, y: 0, z: -33, w: 4, h: 1, d: 4 },
      { id: 'lp8_r8_c3', type: 'hazard', x: 0, y: 0, z: -33, w: 4, h: 1, d: 4 },
      { id: 'lp8_r8_c4', type: 'hazard', x: 4, y: 0, z: -33, w: 4, h: 1, d: 4 },
      { id: 'lp8_r8_c5', type: 'speed', x: 8, y: 0, z: -33, w: 4, h: 1, d: 4 },

      // Row 9 (z = -37)
      { id: 'lp9_r9_c1', type: 'glass', x: -8, y: 0, z: -37, w: 4, h: 1, d: 4 },
      { id: 'lp9_r9_c2', type: 'glass', x: -4, y: 0, z: -37, w: 4, h: 1, d: 4 },
      { id: 'lp9_r9_c3', type: 'normal', x: 0, y: 0, z: -37, w: 4, h: 1, d: 4 },
      { id: 'lp9_r9_c4', type: 'glass', x: 4, y: 0, z: -37, w: 4, h: 1, d: 4 },
      { id: 'lp9_r9_c5', type: 'glass', x: 8, y: 0, z: -37, w: 4, h: 1, d: 4 },

      // Row 10 (z = -41)
      { id: 'lp10_r10_c1', type: 'hazard', x: -8, y: 0, z: -41, w: 4, h: 1, d: 4 },
      { id: 'lp10_r10_c2', type: 'hazard', x: -4, y: 0, z: -41, w: 4, h: 1, d: 4 },
      { id: 'lp10_r10_c3', type: 'glass', x: 0, y: 0, z: -41, w: 4, h: 1, d: 4 },
      { id: 'lp10_r10_c4', type: 'hazard', x: 4, y: 0, z: -41, w: 4, h: 1, d: 4 },
      { id: 'lp10_r10_c5', type: 'hazard', x: 8, y: 0, z: -41, w: 4, h: 1, d: 4 },

      // Row 11 (z = -45)
      { id: 'lp11_r11_c1', type: 'normal', x: -8, y: 0, z: -45, w: 4, h: 1, d: 4 },
      { id: 'lp11_r11_c2', type: 'speed', x: -4, y: 0, z: -45, w: 4, h: 1, d: 4 },
      { id: 'lp11_r11_c3', type: 'hazard', x: 0, y: 0, z: -45, w: 4, h: 1, d: 4 },
      { id: 'lp11_r11_c4', type: 'speed', x: 4, y: 0, z: -45, w: 4, h: 1, d: 4 },
      { id: 'lp11_r11_c5', type: 'normal', x: 8, y: 0, z: -45, w: 4, h: 1, d: 4 },

      // Row 12 (z = -49)
      { id: 'lp12_r12_c1', type: 'hazard', x: -8, y: 0, z: -49, w: 4, h: 1, d: 4 },
      { id: 'lp12_r12_c2', type: 'normal', x: -4, y: 0, z: -49, w: 4, h: 1, d: 4 },
      { id: 'lp12_r12_c3', type: 'speed', x: 0, y: 0, z: -49, w: 4, h: 1, d: 4 },
      { id: 'lp12_r12_c4', type: 'normal', x: 4, y: 0, z: -49, w: 4, h: 1, d: 4 },
      { id: 'lp12_r12_c5', type: 'hazard', x: 8, y: 0, z: -49, w: 4, h: 1, d: 4 },

      // Row 13 (z = -53)
      { id: 'lp13_r13_c1', type: 'hazard', x: -8, y: 0, z: -53, w: 4, h: 1, d: 4 },
      { id: 'lp13_r13_c2', type: 'hazard', x: -4, y: 0, z: -53, w: 4, h: 1, d: 4 },
      { id: 'lp13_r13_c3', type: 'checkpoint', x: 0, y: 0, z: -53, w: 4, h: 1, d: 4 },
      { id: 'lp13_r13_c4', type: 'hazard', x: 4, y: 0, z: -53, w: 4, h: 1, d: 4 },
      { id: 'lp13_r13_c5', type: 'hazard', x: 8, y: 0, z: -53, w: 4, h: 1, d: 4 },

      // Row 14 (z = -57)
      { id: 'lp14_r14_c1', type: 'jump', x: -8, y: 0, z: -57, w: 4, h: 0.8, d: 4 },
      { id: 'lp14_r14_c2', type: 'hazard', x: -4, y: 0, z: -57, w: 4, h: 1, d: 4 },
      { id: 'lp14_r14_c3', type: 'normal', x: 0, y: 0, z: -57, w: 4, h: 1, d: 4 },
      { id: 'lp14_r14_c4', type: 'hazard', x: 4, y: 0, z: -57, w: 4, h: 1, d: 4 },
      { id: 'lp14_r14_c5', type: 'jump', x: 8, y: 0, z: -57, w: 4, h: 0.8, d: 4 },

      // Row 15 (z = -61)
      { id: 'lp15_r15_c1', type: 'glass', x: -8, y: 0, z: -61, w: 4, h: 1, d: 4 },
      { id: 'lp15_r15_c2', type: 'glass', x: -4, y: 0, z: -61, w: 4, h: 1, d: 4 },
      { id: 'lp15_r15_c3', type: 'hazard', x: 0, y: 0, z: -61, w: 4, h: 1, d: 4 },
      { id: 'lp15_r15_c4', type: 'glass', x: 4, y: 0, z: -61, w: 4, h: 1, d: 4 },
      { id: 'lp15_r15_c5', type: 'glass', x: 8, y: 0, z: -61, w: 4, h: 1, d: 4 },

      // Row 16 (z = -65)
      { id: 'lp16_r16_c1', type: 'hazard', x: -8, y: 0, z: -65, w: 4, h: 1, d: 4 },
      { id: 'lp16_r16_c2', type: 'speed', x: -4, y: 0, z: -65, w: 4, h: 1, d: 4 },
      { id: 'lp16_r16_c3', type: 'speed', x: 0, y: 0, z: -65, w: 4, h: 1, d: 4 },
      { id: 'lp16_r16_c4', type: 'speed', x: 4, y: 0, z: -65, w: 4, h: 1, d: 4 },
      { id: 'lp16_r16_c5', type: 'hazard', x: 8, y: 0, z: -65, w: 4, h: 1, d: 4 },

      // Row 17 (z = -69)
      { id: 'lp17_r17_c1', type: 'normal', x: -8, y: 0, z: -69, w: 4, h: 1, d: 4 },
      { id: 'lp17_r17_c2', type: 'hazard', x: -4, y: 0, z: -69, w: 4, h: 1, d: 4 },
      { id: 'lp17_r17_c3', type: 'hazard', x: 0, y: 0, z: -69, w: 4, h: 1, d: 4 },
      { id: 'lp17_r17_c4', type: 'hazard', x: 4, y: 0, z: -69, w: 4, h: 1, d: 4 },
      { id: 'lp17_r17_c5', type: 'normal', x: 8, y: 0, z: -69, w: 4, h: 1, d: 4 },

      // Row 18 (z = -73)
      { id: 'lp18_r18_c1', type: 'glass', x: -8, y: 0, z: -73, w: 4, h: 1, d: 4 },
      { id: 'lp18_r18_c2', type: 'glass', x: -4, y: 0, z: -73, w: 4, h: 1, d: 4 },
      { id: 'lp18_r18_c3', type: 'glass', x: 0, y: 0, z: -73, w: 4, h: 1, d: 4 },
      { id: 'lp18_r18_c4', type: 'glass', x: 4, y: 0, z: -73, w: 4, h: 1, d: 4 },
      { id: 'lp18_r18_c5', type: 'glass', x: 8, y: 0, z: -73, w: 4, h: 1, d: 4 },

      // Row 19 (z = -77)
      { id: 'lp19_r19_c1', type: 'hazard', x: -8, y: 0, z: -77, w: 4, h: 1, d: 4 },
      { id: 'lp19_r19_c2', type: 'speed', x: -4, y: 0, z: -77, w: 4, h: 1, d: 4 },
      { id: 'lp19_r19_c3', type: 'hazard', x: 0, y: 0, z: -77, w: 4, h: 1, d: 4 },
      { id: 'lp19_r19_c4', type: 'speed', x: 4, y: 0, z: -77, w: 4, h: 1, d: 4 },
      { id: 'lp19_r19_c5', type: 'hazard', x: 8, y: 0, z: -77, w: 4, h: 1, d: 4 },

      // Row 20 (z = -81)
      { id: 'lp20_r20_c1', type: 'normal', x: -8, y: 0, z: -81, w: 4, h: 1, d: 4 },
      { id: 'lp20_r20_c2', type: 'hazard', x: -4, y: 0, z: -81, w: 4, h: 1, d: 4 },
      { id: 'lp20_r20_c3', type: 'jump', x: 0, y: 0, z: -81, w: 4, h: 0.8, d: 4 },
      { id: 'lp20_r20_c4', type: 'hazard', x: 4, y: 0, z: -81, w: 4, h: 1, d: 4 },
      { id: 'lp20_r20_c5', type: 'normal', x: 8, y: 0, z: -81, w: 4, h: 1, d: 4 },

      // Row 21 (z = -85)
      { id: 'lp21_r21_c1', type: 'glass', x: -8, y: 0, z: -85, w: 4, h: 1, d: 4 },
      { id: 'lp21_r21_c2', type: 'normal', x: -4, y: 0, z: -85, w: 4, h: 1, d: 4 },
      { id: 'lp21_r21_c3', type: 'normal', x: 0, y: 0, z: -85, w: 4, h: 1, d: 4 },
      { id: 'lp21_r21_c4', type: 'normal', x: 4, y: 0, z: -85, w: 4, h: 1, d: 4 },
      { id: 'lp21_r21_c5', type: 'glass', x: 8, y: 0, z: -85, w: 4, h: 1, d: 4 },

      // Row 22 (z = -89)
      { id: 'lp22_r22_c1', type: 'hazard', x: -8, y: 0, z: -89, w: 4, h: 1, d: 4 },
      { id: 'lp22_r22_c2', type: 'hazard', x: -4, y: 0, z: -89, w: 4, h: 1, d: 4 },
      { id: 'lp22_r22_c3', type: 'normal', x: 0, y: 0, z: -89, w: 4, h: 1, d: 4 },
      { id: 'lp22_r22_c4', type: 'hazard', x: 4, y: 0, z: -89, w: 4, h: 1, d: 4 },
      { id: 'lp22_r22_c5', type: 'hazard', x: 8, y: 0, z: -89, w: 4, h: 1, d: 4 },
      
      // Row 23 (z = -93)
      { id: 'lp23_r23_c1', type: 'hazard', x: -8, y: 0, z: -93, w: 4, h: 1, d: 4 },
      { id: 'lp23_r23_c2', type: 'normal', x: -4, y: 0, z: -93, w: 4, h: 1, d: 4 },
      { id: 'lp23_r23_c3', type: 'normal', x: 0, y: 0, z: -93, w: 4, h: 1, d: 4 },
      { id: 'lp23_r23_c4', type: 'normal', x: 4, y: 0, z: -93, w: 4, h: 1, d: 4 },
      { id: 'lp23_r23_c5', type: 'hazard', x: 8, y: 0, z: -93, w: 4, h: 1, d: 4 },

      // Row 24 (z = -97)
      { id: 'lp24_r24_c1', type: 'hazard', x: -8, y: 0, z: -97, w: 4, h: 1, d: 4 },
      { id: 'lp24_r24_c2', type: 'speed', x: -4, y: 0, z: -97, w: 4, h: 1, d: 4 },
      { id: 'lp24_r24_c3', type: 'hazard', x: 0, y: 0, z: -97, w: 4, h: 1, d: 4 },
      { id: 'lp24_r24_c4', type: 'speed', x: 4, y: 0, z: -97, w: 4, h: 1, d: 4 },
      { id: 'lp24_r24_c5', type: 'hazard', x: 8, y: 0, z: -97, w: 4, h: 1, d: 4 },

      // Row 25 (z = -101)
      { id: 'lp25_r25_c1', type: 'checkpoint', x: -8, y: 0, z: -101, w: 4, h: 1, d: 4 },
      { id: 'lp25_r25_c2', type: 'normal', x: -4, y: 0, z: -101, w: 4, h: 1, d: 4 },
      { id: 'lp25_r25_c3', type: 'normal', x: 0, y: 0, z: -101, w: 4, h: 1, d: 4 },
      { id: 'lp25_r25_c4', type: 'normal', x: 4, y: 0, z: -101, w: 4, h: 1, d: 4 },
      { id: 'lp25_r25_c5', type: 'checkpoint', x: 8, y: 0, z: -101, w: 4, h: 1, d: 4 },

      // Row 26 (z = -105)
      { id: 'lp26_r26_c1', type: 'glass', x: -8, y: 0, z: -105, w: 4, h: 1, d: 4 },
      { id: 'lp26_r26_c2', type: 'hazard', x: -4, y: 0, z: -105, w: 4, h: 1, d: 4 },
      { id: 'lp26_r26_c3', type: 'speed', x: 0, y: 0, z: -105, w: 4, h: 1, d: 4 },
      { id: 'lp26_r26_c4', type: 'hazard', x: 4, y: 0, z: -105, w: 4, h: 1, d: 4 },
      { id: 'lp26_r26_c5', type: 'glass', x: 8, y: 0, z: -105, w: 4, h: 1, d: 4 },

      // Row 27 (z = -109)
      { id: 'lp27_r27_c1', type: 'hazard', x: -8, y: 0, z: -109, w: 4, h: 1, d: 4 },
      { id: 'lp27_r27_c2', type: 'normal', x: -4, y: 0, z: -109, w: 4, h: 1, d: 4 },
      { id: 'lp27_r27_c3', type: 'glass', x: 0, y: 0, z: -109, w: 4, h: 1, d: 4 },
      { id: 'lp27_r27_c4', type: 'normal', x: 4, y: 0, z: -109, w: 4, h: 1, d: 4 },
      { id: 'lp27_r27_c5', type: 'hazard', x: 8, y: 0, z: -109, w: 4, h: 1, d: 4 },

      // Row 28 (z = -113)
      { id: 'lp28_r28_c1', type: 'hazard', x: -8, y: 0, z: -113, w: 4, h: 1, d: 4 },
      { id: 'lp28_r28_c2', type: 'glass', x: -4, y: 0, z: -113, w: 4, h: 1, d: 4 },
      { id: 'lp28_r28_c3', type: 'hazard', x: 0, y: 0, z: -113, w: 4, h: 1, d: 4 },
      { id: 'lp28_r28_c4', type: 'glass', x: 4, y: 0, z: -113, w: 4, h: 1, d: 4 },
      { id: 'lp28_r28_c5', type: 'hazard', x: 8, y: 0, z: -113, w: 4, h: 1, d: 4 },

      // Row 29 (z = -117)
      { id: 'lp29_r29_c1', type: 'normal', x: -8, y: 0, z: -117, w: 4, h: 1, d: 4 },
      { id: 'lp29_r29_c2', type: 'speed', x: -4, y: 0, z: -117, w: 4, h: 1, d: 4 },
      { id: 'lp29_r29_c3', type: 'hazard', x: 0, y: 0, z: -117, w: 4, h: 1, d: 4 },
      { id: 'lp29_r29_c4', type: 'speed', x: 4, y: 0, z: -117, w: 4, h: 1, d: 4 },
      { id: 'lp29_r29_c5', type: 'normal', x: 8, y: 0, z: -117, w: 4, h: 1, d: 4 },

      // Row 30 (z = -121)
      { id: 'lp30_r30_c1', type: 'hazard', x: -8, y: 0, z: -121, w: 4, h: 1, d: 4 },
      { id: 'lp30_r30_c2', type: 'hazard', x: -4, y: 0, z: -121, w: 4, h: 1, d: 4 },
      { id: 'lp30_r30_c3', type: 'jump', x: 0, y: 0, z: -121, w: 4, h: 0.8, d: 4 },
      { id: 'lp30_r30_c4', type: 'hazard', x: 4, y: 0, z: -121, w: 4, h: 1, d: 4 },
      { id: 'lp30_r30_c5', type: 'hazard', x: 8, y: 0, z: -121, w: 4, h: 1, d: 4 },

      // Row 31 (z = -125)
      { id: 'lp31_r31_c1', type: 'normal', x: -8, y: 0, z: -125, w: 4, h: 1, d: 4 },
      { id: 'lp31_r31_c2', type: 'normal', x: -4, y: 0, z: -125, w: 4, h: 1, d: 4 },
      { id: 'lp31_r31_c3', type: 'normal', x: 0, y: 0, z: -125, w: 4, h: 1, d: 4 },
      { id: 'lp31_r31_c4', type: 'normal', x: 4, y: 0, z: -125, w: 4, h: 1, d: 4 },
      { id: 'lp31_r31_c5', type: 'normal', x: 8, y: 0, z: -125, w: 4, h: 1, d: 4 },

      // Row 32 (z = -129)
      { id: 'lp32_r32_c1', type: 'hazard', x: -8, y: 0, z: -129, w: 4, h: 1, d: 4 },
      { id: 'lp32_r32_c2', type: 'hazard', x: -4, y: 0, z: -129, w: 4, h: 1, d: 4 },
      { id: 'lp32_r32_c3', type: 'checkpoint', x: 0, y: 0, z: -129, w: 4, h: 1, d: 4 },
      { id: 'lp32_r32_c4', type: 'hazard', x: 4, y: 0, z: -129, w: 4, h: 1, d: 4 },
      { id: 'lp32_r32_c5', type: 'hazard', x: 8, y: 0, z: -129, w: 4, h: 1, d: 4 },

      // Row 33 (z = -133)
      { id: 'lp33_r33_c1', type: 'speed', x: -8, y: 0, z: -133, w: 4, h: 1, d: 4 },
      { id: 'lp33_r33_c2', type: 'hazard', x: -4, y: 0, z: -133, w: 4, h: 1, d: 4 },
      { id: 'lp33_r33_c3', type: 'normal', x: 0, y: 0, z: -133, w: 4, h: 1, d: 4 },
      { id: 'lp33_r33_c4', type: 'hazard', x: 4, y: 0, z: -133, w: 4, h: 1, d: 4 },
      { id: 'lp33_r33_c5', type: 'speed', x: 8, y: 0, z: -133, w: 4, h: 1, d: 4 },

      // Row 34 (z = -137)
      { id: 'lp34_r34_c1', type: 'hazard', x: -8, y: 0, z: -137, w: 4, h: 1, d: 4 },
      { id: 'lp34_r34_c2', type: 'speed', x: -4, y: 0, z: -137, w: 4, h: 1, d: 4 },
      { id: 'lp34_r34_c3', type: 'speed', x: 0, y: 0, z: -137, w: 4, h: 1, d: 4 },
      { id: 'lp34_r34_c4', type: 'speed', x: 4, y: 0, z: -137, w: 4, h: 1, d: 4 },
      { id: 'lp34_r34_c5', type: 'hazard', x: 8, y: 0, z: -137, w: 4, h: 1, d: 4 },

      // Row 35 (z = -141)
      { id: 'lp35_r35_c1', type: 'glass', x: -8, y: 0, z: -141, w: 4, h: 1, d: 4 },
      { id: 'lp35_r35_c2', type: 'hazard', x: -4, y: 0, z: -141, w: 4, h: 1, d: 4 },
      { id: 'lp35_r35_c3', type: 'hazard', x: 0, y: 0, z: -141, w: 4, h: 1, d: 4 },
      { id: 'lp35_r35_c4', type: 'hazard', x: 4, y: 0, z: -141, w: 4, h: 1, d: 4 },
      { id: 'lp35_r35_c5', type: 'glass', x: 8, y: 0, z: -141, w: 4, h: 1, d: 4 },

      // Row 36 (z = -145)
      { id: 'lp36_r36_c1', type: 'glass', x: -8, y: 0, z: -145, w: 4, h: 1, d: 4 },
      { id: 'lp36_r36_c2', type: 'normal', x: -4, y: 0, z: -145, w: 4, h: 1, d: 4 },
      { id: 'lp36_r36_c3', type: 'jump', x: 0, y: 0, z: -145, w: 4, h: 0.8, d: 4 },
      { id: 'lp36_r36_c4', type: 'normal', x: 4, y: 0, z: -145, w: 4, h: 1, d: 4 },
      { id: 'lp36_r36_c5', type: 'glass', x: 8, y: 0, z: -145, w: 4, h: 1, d: 4 },

      // Row 37 (z = -149)
      { id: 'lp37_r37_c1', type: 'hazard', x: -8, y: 0, z: -149, w: 4, h: 1, d: 4 },
      { id: 'lp37_r37_c2', type: 'hazard', x: -4, y: 0, z: -149, w: 4, h: 1, d: 4 },
      { id: 'lp37_r37_c3', type: 'glass', x: 0, y: 0, z: -149, w: 4, h: 1, d: 4 },
      { id: 'lp37_r37_c4', type: 'hazard', x: 4, y: 0, z: -149, w: 4, h: 1, d: 4 },
      { id: 'lp37_r37_c5', type: 'hazard', x: 8, y: 0, z: -149, w: 4, h: 1, d: 4 },

      // Row 38 (z = -153)
      { id: 'lp38_r38_c1', type: 'speed', x: -8, y: 0, z: -153, w: 4, h: 1, d: 4 },
      { id: 'lp38_r38_c2', type: 'normal', x: -4, y: 0, z: -153, w: 4, h: 1, d: 4 },
      { id: 'lp38_r38_c3', type: 'normal', x: 0, y: 0, z: -153, w: 4, h: 1, d: 4 },
      { id: 'lp38_r38_c4', type: 'normal', x: 4, y: 0, z: -153, w: 4, h: 1, d: 4 },
      { id: 'lp38_r38_c5', type: 'speed', x: 8, y: 0, z: -153, w: 4, h: 1, d: 4 },

      // Row 39 (z = -157)
      { id: 'lp39_r39_c1', type: 'hazard', x: -8, y: 0, z: -157, w: 4, h: 1, d: 4 },
      { id: 'lp39_r39_c2', type: 'glass', x: -4, y: 0, z: -157, w: 4, h: 1, d: 4 },
      { id: 'lp39_r39_c3', type: 'hazard', x: 0, y: 0, z: -157, w: 4, h: 1, d: 4 },
      { id: 'lp39_r39_c4', type: 'glass', x: 4, y: 0, z: -157, w: 4, h: 1, d: 4 },
      { id: 'lp39_r39_c5', type: 'hazard', x: 8, y: 0, z: -157, w: 4, h: 1, d: 4 },

      // Row 40 (z = -161)
      { id: 'lp40_r40_c1', type: 'checkpoint', x: -8, y: 0, z: -161, w: 4, h: 1, d: 4 },
      { id: 'lp40_r40_c2', type: 'hazard', x: -4, y: 0, z: -161, w: 4, h: 1, d: 4 },
      { id: 'lp40_r40_c3', type: 'speed', x: 0, y: 0, z: -161, w: 4, h: 1, d: 4 },
      { id: 'lp40_r40_c4', type: 'hazard', x: 4, y: 0, z: -161, w: 4, h: 1, d: 4 },
      { id: 'lp40_r40_c5', type: 'checkpoint', x: 8, y: 0, z: -161, w: 4, h: 1, d: 4 },

      // Row 41 (z = -165)
      { id: 'lp41_r41_c1', type: 'hazard', x: -8, y: 0, z: -165, w: 4, h: 1, d: 4 },
      { id: 'lp41_r41_c2', type: 'hazard', x: -4, y: 0, z: -165, w: 4, h: 1, d: 4 },
      { id: 'lp41_r41_c3', type: 'normal', x: 0, y: 0, z: -165, w: 4, h: 1, d: 4 },
      { id: 'lp41_r41_c4', type: 'hazard', x: 4, y: 0, z: -165, w: 4, h: 1, d: 4 },
      { id: 'lp41_r41_c5', type: 'hazard', x: 8, y: 0, z: -165, w: 4, h: 1, d: 4 },

      // Row 42 (z = -169)
      { id: 'lp42_r42_c1', type: 'speed', x: -8, y: 0, z: -169, w: 4, h: 1, d: 4 },
      { id: 'lp42_r42_c2', type: 'speed', x: -4, y: 0, z: -169, w: 4, h: 1, d: 4 },
      { id: 'lp42_r42_c3', type: 'normal', x: 0, y: 0, z: -169, w: 4, h: 1, d: 4 },
      { id: 'lp42_r42_c4', type: 'speed', x: 4, y: 0, z: -169, w: 4, h: 1, d: 4 },
      { id: 'lp42_r42_c5', type: 'speed', x: 8, y: 0, z: -169, w: 4, h: 1, d: 4 },

      // Row 43 (z = -173)
      { id: 'lp43_r43_c1', type: 'hazard', x: -8, y: 0, z: -173, w: 4, h: 1, d: 4 },
      { id: 'lp43_r43_c2', type: 'hazard', x: -4, y: 0, z: -173, w: 4, h: 1, d: 4 },
      { id: 'lp43_r43_c3', type: 'glass', x: 0, y: 0, z: -173, w: 4, h: 1, d: 4 },
      { id: 'lp43_r43_c4', type: 'hazard', x: 4, y: 0, z: -173, w: 4, h: 1, d: 4 },
      { id: 'lp43_r43_c5', type: 'hazard', x: 8, y: 0, z: -173, w: 4, h: 1, d: 4 },

      // Row 44 (z = -177)
      { id: 'lp44_r44_c1', type: 'normal', x: -8, y: 0, z: -177, w: 4, h: 1, d: 4 },
      { id: 'lp44_r44_c2', type: 'normal', x: -4, y: 0, z: -177, w: 4, h: 1, d: 4 },
      { id: 'lp44_r44_c3', type: 'jump', x: 0, y: 0, z: -177, w: 4, h: 0.8, d: 4 },
      { id: 'lp44_r44_c4', type: 'normal', x: 4, y: 0, z: -177, w: 4, h: 1, d: 4 },
      { id: 'lp44_r44_c5', type: 'normal', x: 8, y: 0, z: -177, w: 4, h: 1, d: 4 },

      // Row 45 (z = -181)
      { id: 'lp45_r45_c1', type: 'hazard', x: -8, y: 0, z: -181, w: 4, h: 1, d: 4 },
      { id: 'lp45_r45_c2', type: 'glass', x: -4, y: 0, z: -181, w: 4, h: 1, d: 4 },
      { id: 'lp45_r45_c3', type: 'hazard', x: 0, y: 0, z: -181, w: 4, h: 1, d: 4 },
      { id: 'lp45_r45_c4', type: 'glass', x: 4, y: 0, z: -181, w: 4, h: 1, d: 4 },
      { id: 'lp45_r45_c5', type: 'hazard', x: 8, y: 0, z: -181, w: 4, h: 1, d: 4 },

      // Row 46 (z = -185)
      { id: 'lp46_r46_c1', type: 'speed', x: -8, y: 0, z: -185, w: 4, h: 1, d: 4 },
      { id: 'lp46_r46_c2', type: 'hazard', x: -4, y: 0, z: -185, w: 4, h: 1, d: 4 },
      { id: 'lp46_r46_c3', type: 'speed', x: 0, y: 0, z: -185, w: 4, h: 1, d: 4 },
      { id: 'lp46_r46_c4', type: 'hazard', x: 4, y: 0, z: -185, w: 4, h: 1, d: 4 },
      { id: 'lp46_r46_c5', type: 'speed', x: 8, y: 0, z: -185, w: 4, h: 1, d: 4 },

      // Row 47 (z = -189)
      { id: 'lp47_r47_c1', type: 'hazard', x: -8, y: 0, z: -189, w: 4, h: 1, d: 4 },
      { id: 'lp47_r47_c2', type: 'checkpoint', x: -4, y: 0, z: -189, w: 4, h: 1, d: 4 },
      { id: 'lp47_r47_c3', type: 'hazard', x: 0, y: 0, z: -189, w: 4, h: 1, d: 4 },
      { id: 'lp47_r47_c4', type: 'checkpoint', x: 4, y: 0, z: -189, w: 4, h: 1, d: 4 },
      { id: 'lp47_r47_c5', type: 'hazard', x: 8, y: 0, z: -189, w: 4, h: 1, d: 4 },

      // Row 48 (z = -193)
      { id: 'lp48_r48_c1', type: 'glass', x: -8, y: 0, z: -193, w: 4, h: 1, d: 4 },
      { id: 'lp48_r48_c2', type: 'glass', x: -4, y: 0, z: -193, w: 4, h: 1, d: 4 },
      { id: 'lp48_r48_c3', type: 'normal', x: 0, y: 0, z: -193, w: 4, h: 1, d: 4 },
      { id: 'lp48_r48_c4', type: 'glass', x: 4, y: 0, z: -193, w: 4, h: 1, d: 4 },
      { id: 'lp48_r48_c5', type: 'glass', x: 8, y: 0, z: -193, w: 4, h: 1, d: 4 },

      // Row 49 (z = -197)
      { id: 'lp49_r49_c1', type: 'hazard', x: -8, y: 0, z: -197, w: 4, h: 1, d: 4 },
      { id: 'lp49_r49_c2', type: 'hazard', x: -4, y: 0, z: -197, w: 4, h: 1, d: 4 },
      { id: 'lp49_r49_c3', type: 'jump', x: 0, y: 0, z: -197, w: 4, h: 0.8, d: 4 },
      { id: 'lp49_r49_c4', type: 'hazard', x: 4, y: 0, z: -197, w: 4, h: 1, d: 4 },
      { id: 'lp49_r49_c5', type: 'hazard', x: 8, y: 0, z: -197, w: 4, h: 1, d: 4 },

      // Row 50 (z = -201)
      { id: 'lp50_r50_c1', type: 'normal', x: -8, y: 0, z: -201, w: 4, h: 1, d: 4 },
      { id: 'lp50_r50_c2', type: 'normal', x: -4, y: 0, z: -201, w: 4, h: 1, d: 4 },
      { id: 'lp50_r50_c3', type: 'normal', x: 0, y: 0, z: -201, w: 4, h: 1, d: 4 },
      { id: 'lp50_r50_c4', type: 'normal', x: 4, y: 0, z: -201, w: 4, h: 1, d: 4 },
      { id: 'lp50_r50_c5', type: 'normal', x: 8, y: 0, z: -201, w: 4, h: 1, d: 4 },

      // Row 51 (z = -205)
      { id: 'lp51_r51_c1', type: 'speed', x: -8, y: 0, z: -205, w: 4, h: 1, d: 4 },
      { id: 'lp51_r51_c2', type: 'hazard', x: -4, y: 0, z: -205, w: 4, h: 1, d: 4 },
      { id: 'lp51_r51_c3', type: 'glass', x: 0, y: 0, z: -205, w: 4, h: 1, d: 4 },
      { id: 'lp51_r51_c4', type: 'hazard', x: 4, y: 0, z: -205, w: 4, h: 1, d: 4 },
      { id: 'lp51_r51_c5', type: 'speed', x: 8, y: 0, z: -205, w: 4, h: 1, d: 4 },

      // Row 52 (z = -209)
      { id: 'lp52_r52_c1', type: 'hazard', x: -8, y: 0, z: -209, w: 4, h: 1, d: 4 },
      { id: 'lp52_r52_c2', type: 'speed', x: -4, y: 0, z: -209, w: 4, h: 1, d: 4 },
      { id: 'lp52_r52_c3', type: 'hazard', x: 0, y: 0, z: -209, w: 4, h: 1, d: 4 },
      { id: 'lp52_r52_c4', type: 'speed', x: 4, y: 0, z: -209, w: 4, h: 1, d: 4 },
      { id: 'lp52_r52_c5', type: 'hazard', x: 8, y: 0, z: -209, w: 4, h: 1, d: 4 },

      // Row 53 (z = -213)
      { id: 'lp53_r53_c1', type: 'glass', x: -8, y: 0, z: -213, w: 4, h: 1, d: 4 },
      { id: 'lp53_r53_c2', type: 'hazard', x: -4, y: 0, z: -213, w: 4, h: 1, d: 4 },
      { id: 'lp53_r53_c3', type: 'normal', x: 0, y: 0, z: -213, w: 4, h: 1, d: 4 },
      { id: 'lp53_r53_c4', type: 'hazard', x: 4, y: 0, z: -213, w: 4, h: 1, d: 4 },
      { id: 'lp53_r53_c5', type: 'glass', x: 8, y: 0, z: -213, w: 4, h: 1, d: 4 },

      // Row 54 (z = -217)
      { id: 'lp54_r54_c1', type: 'hazard', x: -8, y: 0, z: -217, w: 4, h: 1, d: 4 },
      { id: 'lp54_r54_c2', type: 'glass', x: -4, y: 0, z: -217, w: 4, h: 1, d: 4 },
      { id: 'lp54_r54_c3', type: 'hazard', x: 0, y: 0, z: -217, w: 4, h: 1, d: 4 },
      { id: 'lp54_r54_c4', type: 'glass', x: 4, y: 0, z: -217, w: 4, h: 1, d: 4 },
      { id: 'lp54_r54_c5', type: 'hazard', x: 8, y: 0, z: -217, w: 4, h: 1, d: 4 },

      // Row 55 (z = -221)
      { id: 'lp55_r55_c1', type: 'checkpoint', x: -8, y: 0, z: -221, w: 4, h: 1, d: 4 },
      { id: 'lp55_r55_c2', type: 'normal', x: -4, y: 0, z: -221, w: 4, h: 1, d: 4 },
      { id: 'lp55_r55_c3', type: 'checkpoint', x: 0, y: 0, z: -221, w: 4, h: 1, d: 4 },
      { id: 'lp55_r55_c4', type: 'normal', x: 4, y: 0, z: -221, w: 4, h: 1, d: 4 },
      { id: 'lp55_r55_c5', type: 'checkpoint', x: 8, y: 0, z: -221, w: 4, h: 1, d: 4 },

      // Row 56 (z = -225)
      { id: 'lp56_r56_c1', type: 'hazard', x: -8, y: 0, z: -225, w: 4, h: 1, d: 4 },
      { id: 'lp56_r56_c2', type: 'hazard', x: -4, y: 0, z: -225, w: 4, h: 1, d: 4 },
      { id: 'lp56_r56_c3', type: 'jump', x: 0, y: 0, z: -225, w: 4, h: 0.8, d: 4 },
      { id: 'lp56_r56_c4', type: 'hazard', x: 4, y: 0, z: -225, w: 4, h: 1, d: 4 },
      { id: 'lp56_r56_c5', type: 'hazard', x: 8, y: 0, z: -225, w: 4, h: 1, d: 4 },

      // Row 57 (z = -229)
      { id: 'lp57_r57_c1', type: 'normal', x: -8, y: 0, z: -229, w: 4, h: 1, d: 4 },
      { id: 'lp57_r57_c2', type: 'speed', x: -4, y: 0, z: -229, w: 4, h: 1, d: 4 },
      { id: 'lp57_r57_c3', type: 'hazard', x: 0, y: 0, z: -229, w: 4, h: 1, d: 4 },
      { id: 'lp57_r57_c4', type: 'speed', x: 4, y: 0, z: -229, w: 4, h: 1, d: 4 },
      { id: 'lp57_r57_c5', type: 'normal', x: 8, y: 0, z: -229, w: 4, h: 1, d: 4 },

      // Row 58 (z = -233)
      { id: 'lp58_r58_c1', type: 'glass', x: -8, y: 0, z: -233, w: 4, h: 1, d: 4 },
      { id: 'lp58_r58_c2', type: 'hazard', x: -4, y: 0, z: -233, w: 4, h: 1, d: 4 },
      { id: 'lp58_r58_c3', type: 'normal', x: 0, y: 0, z: -233, w: 4, h: 1, d: 4 },
      { id: 'lp58_r58_c4', type: 'hazard', x: 4, y: 0, z: -233, w: 4, h: 1, d: 4 },
      { id: 'lp58_r58_c5', type: 'glass', x: 8, y: 0, z: -233, w: 4, h: 1, d: 4 },

      // Row 59 (z = -237)
      { id: 'lp59_r59_c1', type: 'hazard', x: -8, y: 0, z: -237, w: 4, h: 1, d: 4 },
      { id: 'lp59_r59_c2', type: 'glass', x: -4, y: 0, z: -237, w: 4, h: 1, d: 4 },
      { id: 'lp59_r59_c3', type: 'glass', x: 0, y: 0, z: -237, w: 4, h: 1, d: 4 },
      { id: 'lp59_r59_c4', type: 'glass', x: 4, y: 0, z: -237, w: 4, h: 1, d: 4 },
      { id: 'lp59_r59_c5', type: 'hazard', x: 8, y: 0, z: -237, w: 4, h: 1, d: 4 },

      // Row 60 (z = -241)
      { id: 'lp60_r60_c1', type: 'speed', x: -8, y: 0, z: -241, w: 4, h: 1, d: 4 },
      { id: 'lp60_r60_c2', type: 'hazard', x: -4, y: 0, z: -241, w: 4, h: 1, d: 4 },
      { id: 'lp60_r60_c3', type: 'speed', x: 0, y: 0, z: -241, w: 4, h: 1, d: 4 },
      { id: 'lp60_r60_c4', type: 'hazard', x: 4, y: 0, z: -241, w: 4, h: 1, d: 4 },
      { id: 'lp60_r60_c5', type: 'speed', x: 8, y: 0, z: -241, w: 4, h: 1, d: 4 },

      // Row 61 (z = -245)
      { id: 'lp61_r61_c1', type: 'hazard', x: -8, y: 0, z: -245, w: 4, h: 1, d: 4 },
      { id: 'lp61_r61_c2', type: 'normal', x: -4, y: 0, z: -245, w: 4, h: 1, d: 4 },
      { id: 'lp61_r61_c3', type: 'hazard', x: 0, y: 0, z: -245, w: 4, h: 1, d: 4 },
      { id: 'lp61_r61_c4', type: 'normal', x: 4, y: 0, z: -245, w: 4, h: 1, d: 4 },
      { id: 'lp61_r61_c5', type: 'hazard', x: 8, y: 0, z: -245, w: 4, h: 1, d: 4 },

      // Row 62 (z = -249)
      { id: 'lp62_r62_c1', type: 'normal', x: -8, y: 0, z: -249, w: 4, h: 1, d: 4 },
      { id: 'lp62_r62_c2', type: 'hazard', x: -4, y: 0, z: -249, w: 4, h: 1, d: 4 },
      { id: 'lp62_r62_c3', type: 'checkpoint', x: 0, y: 0, z: -249, w: 4, h: 1, d: 4 },
      { id: 'lp62_r62_c4', type: 'hazard', x: 4, y: 0, z: -249, w: 4, h: 1, d: 4 },
      { id: 'lp62_r62_c5', type: 'normal', x: 8, y: 0, z: -249, w: 4, h: 1, d: 4 },

      // Row 63 (z = -253)
      { id: 'lp63_r63_c1', type: 'hazard', x: -8, y: 0, z: -253, w: 4, h: 1, d: 4 },
      { id: 'lp63_r63_c2', type: 'speed', x: -4, y: 0, z: -253, w: 4, h: 1, d: 4 },
      { id: 'lp63_r63_c3', type: 'hazard', x: 0, y: 0, z: -253, w: 4, h: 1, d: 4 },
      { id: 'lp63_r63_c4', type: 'speed', x: 4, y: 0, z: -253, w: 4, h: 1, d: 4 },
      { id: 'lp63_r63_c5', type: 'hazard', x: 8, y: 0, z: -253, w: 4, h: 1, d: 4 },

      // Row 64 (z = -257)
      { id: 'lp64_r64_c1', type: 'glass', x: -8, y: 0, z: -257, w: 4, h: 1, d: 4 },
      { id: 'lp64_r64_c2', type: 'hazard', x: -4, y: 0, z: -257, w: 4, h: 1, d: 4 },
      { id: 'lp64_r64_c3', type: 'glass', x: 0, y: 0, z: -257, w: 4, h: 1, d: 4 },
      { id: 'lp64_r64_c4', type: 'hazard', x: 4, y: 0, z: -257, w: 4, h: 1, d: 4 },
      { id: 'lp64_r64_c5', type: 'glass', x: 8, y: 0, z: -257, w: 4, h: 1, d: 4 },

      // Row 65 (z = -261)
      { id: 'lp65_r65_c1', type: 'hazard', x: -8, y: 0, z: -261, w: 4, h: 1, d: 4 },
      { id: 'lp65_r65_c2', type: 'jump', x: -4, y: 0, z: -261, w: 4, h: 0.8, d: 4 },
      { id: 'lp65_r65_c3', type: 'hazard', x: 0, y: 0, z: -261, w: 4, h: 1, d: 4 },
      { id: 'lp65_r65_c4', type: 'jump', x: 4, y: 0, z: -261, w: 4, h: 0.8, d: 4 },
      { id: 'lp65_r65_c5', type: 'hazard', x: 8, y: 0, z: -261, w: 4, h: 1, d: 4 },

      // Row 66 (z = -265)
      { id: 'lp66_r66_c1', type: 'normal', x: -8, y: 0, z: -265, w: 4, h: 1, d: 4 },
      { id: 'lp66_r66_c2', type: 'normal', x: -4, y: 0, z: -265, w: 4, h: 1, d: 4 },
      { id: 'lp66_r66_c3', type: 'normal', x: 0, y: 0, z: -265, w: 4, h: 1, d: 4 },
      { id: 'lp66_r66_c4', type: 'normal', x: 4, y: 0, z: -265, w: 4, h: 1, d: 4 },
      { id: 'lp66_r66_c5', type: 'normal', x: 8, y: 0, z: -265, w: 4, h: 1, d: 4 },

      // Row 67 (z = -269)
      { id: 'lp67_r67_c1', type: 'hazard', x: -8, y: 0, z: -269, w: 4, h: 1, d: 4 },
      { id: 'lp67_r67_c2', type: 'hazard', x: -4, y: 0, z: -269, w: 4, h: 1, d: 4 },
      { id: 'lp67_r67_c3', type: 'speed', x: 0, y: 0, z: -269, w: 4, h: 1, d: 4 },
      { id: 'lp67_r67_c4', type: 'hazard', x: 4, y: 0, z: -269, w: 4, h: 1, d: 4 },
      { id: 'lp67_r67_c5', type: 'hazard', x: 8, y: 0, z: -269, w: 4, h: 1, d: 4 },

      // Row 68 (z = -273)
      { id: 'lp68_r68_c1', type: 'normal', x: -8, y: 0, z: -273, w: 4, h: 1, d: 4 },
      { id: 'lp68_r68_c2', type: 'normal', x: -4, y: 0, z: -273, w: 4, h: 1, d: 4 },
      { id: 'lp68_r68_c3', type: 'normal', x: 0, y: 0, z: -273, w: 4, h: 1, d: 4 },
      { id: 'lp68_r68_c4', type: 'normal', x: 4, y: 0, z: -273, w: 4, h: 1, d: 4 },
      { id: 'lp68_r68_c5', type: 'normal', x: 8, y: 0, z: -273, w: 4, h: 1, d: 4 },

      // Row 69 (z = -277)
      { id: 'lp69_r69_c1', type: 'glass', x: -8, y: 0, z: -277, w: 4, h: 1, d: 4 },
      { id: 'lp69_r69_c2', type: 'glass', x: -4, y: 0, z: -277, w: 4, h: 1, d: 4 },
      { id: 'lp69_r69_c3', type: 'glass', x: 0, y: 0, z: -277, w: 4, h: 1, d: 4 },
      { id: 'lp69_r69_c4', type: 'glass', x: 4, y: 0, z: -277, w: 4, h: 1, d: 4 },
      { id: 'lp69_r69_c5', type: 'glass', x: 8, y: 0, z: -277, w: 4, h: 1, d: 4 },

      // Row 70 (z = -281)
      { id: 'lp70_r70_c1', type: 'hazard', x: -8, y: 0, z: -281, w: 4, h: 1, d: 4 },
      { id: 'lp70_r70_c2', type: 'hazard', x: -4, y: 0, z: -281, w: 4, h: 1, d: 4 },
      { id: 'lp70_r70_c3', type: 'speed', x: 0, y: 0, z: -281, w: 4, h: 1, d: 4 },
      { id: 'lp70_r70_c4', type: 'hazard', x: 4, y: 0, z: -281, w: 4, h: 1, d: 4 },
      { id: 'lp70_r70_c5', type: 'hazard', x: 8, y: 0, z: -281, w: 4, h: 1, d: 4 },

      // Row 71 (z = -285)
      { id: 'lp71_r71_c1', type: 'checkpoint', x: -8, y: 0, z: -285, w: 4, h: 1, d: 4 },
      { id: 'lp71_r71_c2', type: 'normal', x: -4, y: 0, z: -285, w: 4, h: 1, d: 4 },
      { id: 'lp71_r71_c3', type: 'normal', x: 0, y: 0, z: -285, w: 4, h: 1, d: 4 },
      { id: 'lp71_r71_c4', type: 'normal', x: 4, y: 0, z: -285, w: 4, h: 1, d: 4 },
      { id: 'lp71_r71_c5', type: 'checkpoint', x: 8, y: 0, z: -285, w: 4, h: 1, d: 4 },

      // End Reactor Node
      { id: 'lp72_end', type: 'end', x: 0, y: 0, z: -293, w: 6, h: 1, d: 6 }
    ]
  }
];
