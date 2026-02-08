'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import Link from 'next/link'

const productOntology = [
  {
    category: 'Fuels',
    products: [
      {
        name: 'Petrol (MS – Motor Spirit)',
        description: 'Light distillate fuel supplied to industrial and institutional users; conforms to BIS specifications; quality tested prior to delivery.',
      },
      {
        name: 'High-Speed Diesel (HSD)',
        description: 'Middle distillate fuel for industrial engines, power generation, mining, and transport; BIS compliant and quality-certified.',
      },
      {
        name: 'Light Diesel Oil (LDO)',
        description: 'Industrial distillate fuel used in boilers, furnaces, and small diesel engines; supplied under direct sales contracts.',
      },
      {
        name: 'Furnace Oil (FO)',
        description: 'Heavy residual fuel for industrial furnaces and boilers; supplied with technical support and quality assurance.',
      },
      {
        name: 'Low Sulphur Heavy Stock (LSHS)',
        description: 'Residual fuel with reduced sulphur content for industries with emission constraints; BIS compliant.',
      },
      {
        name: 'Superior Kerosene Oil (SKO)',
        description: 'Refined kerosene grade supplied to industrial and institutional customers under regulated conditions.',
      },
    ],
  },
  {
    category: 'Sulphur',
    products: [
      {
        name: 'Sulphur (Molten)',
        description: 'Refinery by-product used primarily for manufacture of sulphuric acid; supplied in molten form; regulatory clearances required.',
      },
      {
        name: 'Sulphur (Solid / Lumps)',
        description: 'Solid sulphur supplied mainly for sulphuric acid manufacturing; also used in explosives and chemical industries with statutory NOC.',
      },
    ],
  },
  {
    category: 'Bitumen',
    products: [
      {
        name: 'Bitumen VG-10',
        description: 'Paving-grade bitumen meeting IS 73-2013; used in road and infrastructure construction.',
      },
      {
        name: 'Bitumen VG-30',
        description: 'Standard paving-grade bitumen for highways and airport runways; conforms to BIS specifications.',
      },
      {
        name: 'Bitumen VG-40',
        description: 'High-viscosity paving bitumen for heavy traffic loads; BIS compliant.',
      },
      {
        name: 'Crumb Rubber Modified Bitumen (CRMB)',
        description: 'Modified bitumen with rubber additives for enhanced durability and performance.',
      },
      {
        name: 'Polymer Modified Bitumen (PMB)',
        description: 'Polymer-enhanced bitumen for improved elasticity and fatigue resistance.',
      },
      {
        name: 'Bitumen Emulsion',
        description: 'Bitumen dispersed in water for cold application in road construction and maintenance.',
      },
    ],
  },
  {
    category: 'Marine Fuels',
    products: [
      {
        name: 'Very Low Sulphur Fuel Oil (VLSFO)',
        description: 'Marine bunker fuel meeting IMO 2020 and ISO 8217-2017 standards for ocean-going vessels.',
      },
      {
        name: 'Marine Gas Oil HFHSD',
        description: 'High-flash marine diesel fuel meeting BIS specifications for marine engines.',
      },
    ],
  },
  {
    category: 'Specialty Products',
    products: [
      {
        name: 'Hexane',
        description: 'Light hydrocarbon solvent used in edible oil extraction and chemical industries.',
      },
      {
        name: 'Solvent 1425',
        description: 'Aromatic solvent for paint, rubber, and chemical applications.',
      },
      {
        name: 'Mineral Turpentine Oil (MTO)',
        description: 'Industrial solvent used in paints, coatings, and cleaning processes.',
      },
      {
        name: 'Jute Batch Oil (JBO)',
        description: 'Specialty oil used mainly in jute processing; also used as wash oil in steel industry coke oven plants.',
      },
    ],
  },
  {
    category: 'Propylene',
    products: [
      {
        name: 'Propylene (Chemical Grade)',
        description: 'Petrochemical feedstock produced at Visakh Refinery; supplied to petrochemical and polymer industries.',
      },
    ],
  },
  {
    category: 'R&D Products',
    products: [
      {
        name: 'R&D / Pilot Products',
        description: 'Limited-scale refinery or specialty products supplied for testing, trials, or specialized industrial requirements.',
      },
    ],
  },
]

const categoryColors: Record<string, string> = {
  'Fuels': 'bg-blue-100 text-blue-800 border-blue-300',
  'Bitumen': 'bg-gray-100 text-gray-800 border-gray-300',
  'Marine Fuels': 'bg-cyan-100 text-cyan-800 border-cyan-300',
  'Specialty Products': 'bg-purple-100 text-purple-800 border-purple-300',
  'Sulphur': 'bg-yellow-100 text-yellow-800 border-yellow-300',
  'Propylene': 'bg-green-100 text-green-800 border-green-300',
  'R&D Products': 'bg-orange-100 text-orange-800 border-orange-300',
}

export default function ProductOntologyPage() {
  const totalProducts = productOntology.reduce((sum, cat) => sum + cat.products.length, 0)
  const largestCategory = productOntology.reduce((max, cat) => 
    cat.products.length > max.products.length ? cat : max
  , productOntology[0])

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-card">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-lg md:text-xl font-bold text-foreground">HP Direct Product Ontology</h1>
          <Link
            href="/"
            className="text-sm font-medium text-accent hover:underline"
          >
            Back to Dashboard →
          </Link>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="border-border">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground font-medium mb-1">Total Categories</p>
              <p className="text-3xl font-bold text-foreground">{productOntology.length}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground font-medium mb-1">Total Products</p>
              <p className="text-3xl font-bold text-foreground">{totalProducts}</p>
            </CardContent>
          </Card>
          <Card className="border-border">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground font-medium mb-1">Largest Category</p>
              <p className="text-3xl font-bold text-foreground">{largestCategory.category}</p>
              <p className="text-xs text-muted-foreground mt-1">{largestCategory.products.length} products</p>
            </CardContent>
          </Card>
        </div>

        {/* Product Ontology Table */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-xl">Product Categories & Descriptions</CardTitle>
            <p className="text-sm text-muted-foreground">
              Comprehensive listing of HPCL direct sales products organized by category
            </p>
          </CardHeader>
          <CardContent>
            <div className="border border-border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[200px]">Category</TableHead>
                    <TableHead className="w-[280px]">Product Name</TableHead>
                    <TableHead>Description</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productOntology.map((category, catIdx) => {
                    let rowIndex = 0
                    // Calculate starting row index for this category
                    for (let i = 0; i < catIdx; i++) {
                      rowIndex += productOntology[i].products.length
                    }
                    
                    return category.products.map((product, prodIdx) => {
                      const currentRowIndex = rowIndex + prodIdx
                      const isEven = currentRowIndex % 2 === 0
                      
                      return (
                        <TableRow key={`${catIdx}-${prodIdx}`} className={isEven ? 'bg-white' : 'bg-muted/30'}>
                          {prodIdx === 0 ? (
                            <TableCell
                              rowSpan={category.products.length}
                              className="align-top font-semibold"
                            >
                              <Badge
                                variant="outline"
                                className={`${categoryColors[category.category] || 'bg-gray-100 text-gray-800'}`}
                              >
                                {category.category}
                              </Badge>
                              <p className="text-xs text-muted-foreground mt-2">
                                {category.products.length} {category.products.length === 1 ? 'product' : 'products'}
                              </p>
                            </TableCell>
                          ) : null}
                          <TableCell className="font-medium">
                            {product.name}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {product.description}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Category Cards View (Alternative Mobile-Friendly View) */}
        <div className="md:hidden space-y-4">
          <h2 className="text-lg font-semibold text-foreground">Category View</h2>
          {productOntology.map((category, idx) => (
            <Card key={idx} className="border-border">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={`${categoryColors[category.category] || 'bg-gray-100 text-gray-800'}`}
                  >
                    {category.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {category.products.length} {category.products.length === 1 ? 'product' : 'products'}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {category.products.map((product, pIdx) => (
                    <div key={pIdx} className="pb-3 border-b border-border last:border-0 last:pb-0">
                      <p className="font-medium text-sm mb-1">{product.name}</p>
                      <p className="text-xs text-muted-foreground">{product.description}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
